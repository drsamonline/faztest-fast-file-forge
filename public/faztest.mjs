#!/usr/bin/env node
import { constants, brotliCompressSync, brotliDecompressSync } from "node:zlib";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_QUALITY = 5;
const QUALITIES = [1, 5, 9];
const DEFAULT_ITERATIONS = 3;

export function compressBuffer(input, quality = DEFAULT_QUALITY) {
  if (!Number.isInteger(quality) || quality < 0 || quality > 11) {
    throw new Error("Quality must be a whole number from 0 to 11.");
  }
  return brotliCompressSync(input, {
    params: { [constants.BROTLI_PARAM_QUALITY]: quality },
  });
}

export function decompressBuffer(input) {
  return brotliDecompressSync(input);
}

export function outputPathFor(operation, input) {
  if (operation === "compress") return `${input}.br`;
  if (input.toLowerCase().endsWith(".br")) return input.slice(0, -3);
  return `${input}.out`;
}

export function parseArgs(args) {
  const [operation, input, ...flags] = args;
  if (!operation || ["--help", "-h", "help"].includes(operation)) return { help: true };
  if (!["compress", "decompress", "bench", "benchmark"].includes(operation)) {
    throw new Error(`Unknown command: ${operation}`);
  }

  const parsed = {
    operation: operation === "benchmark" ? "bench" : operation,
    input: input && !input.startsWith("-") ? input : undefined,
    output: undefined,
    quality: DEFAULT_QUALITY,
    iterations: DEFAULT_ITERATIONS,
    ziptastic: undefined,
    force: false,
  };

  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index];
    const value = flags[index + 1];
    if (flag === "-o" || flag === "--output") {
      if (!value || value.startsWith("-")) throw new Error(`${flag} requires a file path.`);
      parsed.output = value;
      index += 1;
    } else if (flag === "-q" || flag === "--level" || flag === "--quality") {
      if (!value || !/^\d+$/.test(value) || Number(value) > 11) {
        throw new Error("Quality must be a whole number from 0 to 11.");
      }
      parsed.quality = Number(value);
      index += 1;
    } else if (flag === "-n" || flag === "--iterations") {
      if (!value || !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 20) {
        throw new Error("Iterations must be a whole number from 1 to 20.");
      }
      parsed.iterations = Number(value);
      index += 1;
    } else if (flag === "--ziptastic") {
      if (!value || value.startsWith("-")) {
        throw new Error("--ziptastic requires the path to your Ziptastic executable.");
      }
      parsed.ziptastic = value;
      index += 1;
    } else if (flag === "-f" || flag === "--force") {
      parsed.force = true;
    } else if (flag === "--help" || flag === "-h") {
      return { help: true };
    } else {
      throw new Error(`Unknown option: ${flag}`);
    }
  }

  if (!parsed.input) throw new Error("Provide an input file path.");
  if (parsed.operation !== "compress" && parsed.quality !== DEFAULT_QUALITY) {
    throw new Error("The quality option is only for compression.");
  }
  if (parsed.operation !== "bench" && parsed.iterations !== DEFAULT_ITERATIONS) {
    throw new Error("The iterations option is only for benchmarking.");
  }
  if (parsed.operation === "bench" && parsed.output) {
    throw new Error("The output option is only for compress or decompress.");
  }
  if (parsed.operation !== "bench" && parsed.ziptastic) {
    throw new Error("The --ziptastic option is only for benchmarking.");
  }

  return parsed;
}

export function formatBytes(bytes) {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(1)} kB`;
  return `${(bytes / 1_000_000).toFixed(2)} MB`;
}

function summarize(operation, input, output, started) {
  const seconds = (performance.now() - started) / 1000;
  const reduction = input.length === 0 ? "—" : `${((1 - output.length / input.length) * 100).toFixed(1)}%`;
  console.log(`${operation} complete`);
  console.log(`  Original:  ${formatBytes(input.length)}`);
  console.log(`  Result:    ${formatBytes(output.length)} (${reduction} smaller)`);
  console.log(`  Time:      ${seconds.toFixed(3)} s`);
}

async function assertSafeOutput(inputPath, outputPath, force) {
  const inputResolved = path.resolve(inputPath);
  const outputResolved = path.resolve(outputPath);
  if (inputResolved === outputResolved) throw new Error("Input and output must be different files.");

  try {
    const [inputStat, outputStat] = await Promise.all([stat(inputResolved), stat(outputResolved)]);
    if (inputStat.dev === outputStat.dev && inputStat.ino === outputStat.ino) {
      throw new Error("Input and output point to the same file.");
    }
    if (!force) {
      throw new Error(`Output already exists: ${outputPath} (use --force to replace it).`);
    }
  } catch (error) {
    if (error instanceof Error && !("code" in error && error.code === "ENOENT")) throw error;
  }
}

async function saveOutput(outputPath, content, force) {
  await mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
  try {
    await writeFile(outputPath, content, { flag: force ? "w" : "wx" });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      throw new Error(`Output already exists: ${outputPath} (use --force to replace it).`);
    }
    throw error;
  }
}

async function compressFile(options) {
  const { input, output, quality, force } = options;
  const destination = output ?? outputPathFor("compress", input);
  await assertSafeOutput(input, destination, force);
  const bytes = await readFile(input);
  const started = performance.now();
  const compressed = compressBuffer(bytes, quality);
  await saveOutput(destination, compressed, force);
  console.log(`Saved ${destination} · Brotli quality ${quality}`);
  summarize("Compression", bytes, compressed, started);
}

async function decompressFile(options) {
  const { input, output, force } = options;
  const destination = output ?? outputPathFor("decompress", input);
  await assertSafeOutput(input, destination, force);
  const bytes = await readFile(input);
  const started = performance.now();
  const decompressed = decompressBuffer(bytes);
  await saveOutput(destination, decompressed, force);
  console.log(`Saved ${destination}`);
  summarize("Decompression", bytes, decompressed, started);
}

function startProcess(command, args, outputPath) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(command, args, {
        stdio: outputPath ? ["ignore", "pipe", "ignore"] : "ignore",
      });
    } catch (error) {
      reject(error);
      return;
    }

    let settled = false;
    let outputTask = Promise.resolve();
    if (outputPath && child.stdout) {
      outputTask = pipeline(child.stdout, createWriteStream(outputPath));
    }
    const rejectOnce = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    child.once("error", rejectOnce);
    child.once("close", async (code) => {
      if (settled) return;
      try {
        await outputTask;
        if (code !== 0) throw new Error(`${command} exited with status ${code ?? "unknown"}.`);
        settled = true;
        resolve(undefined);
      } catch (error) {
        rejectOnce(error);
      }
    });
    outputTask.catch((error) => {
      if (!settled) child.kill();
      rejectOnce(error);
    });
  });
}

async function commandAvailable(command, args) {
  try {
    await startProcess(command, args);
    return true;
  } catch {
    return false;
  }
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
    : sorted[midpoint];
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function benchFile({ input, iterations }) {
  const original = await readFile(input);
  const originalHash = sha256(original);
  const scratch = await mkdtemp(path.join(tmpdir(), "faztest-bench-"));
  const results = [];

  console.log(`Faztest benchmark · ${input} · ${formatBytes(original.length)} · ${iterations} trial${iterations === 1 ? "" : "s"}`);
  console.log("Testing single-thread compression. All timings include a fresh process and reading the file.");
  console.log("Ratios and speeds depend on your file, tool versions, and computer.\n");

  try {
    for (const quality of QUALITIES) {
      const times = [];
      let size = 0;
      for (let trial = 0; trial < iterations; trial += 1) {
        const archive = path.join(scratch, `brotli-${quality}-${trial}.br`);
        const restored = path.join(scratch, `brotli-${quality}-${trial}.out`);
        const started = performance.now();
        await startProcess(process.execPath, [
          fileURLToPath(import.meta.url),
          "__bench-brotli",
          path.resolve(input),
          archive,
          String(quality),
        ]);
        times.push((performance.now() - started) / 1000);
        size = (await stat(archive)).size;
        const result = await readFile(archive);
        await writeFile(restored, brotliDecompressSync(result));
        if (sha256(await readFile(restored)) !== originalHash) {
          throw new Error(`Brotli quality ${quality} did not round-trip correctly.`);
        }
      }
      results.push({ name: `Faztest · Brotli q${quality}`, size, seconds: median(times) });
    }

    if (await commandAvailable("xz", ["--version"])) {
      for (const quality of QUALITIES) {
        const times = [];
        let size = 0;
        for (let trial = 0; trial < iterations; trial += 1) {
          const archive = path.join(scratch, `xz-${quality}-${trial}.xz`);
          const restored = path.join(scratch, `xz-${quality}-${trial}.out`);
          const started = performance.now();
          await startProcess("xz", [`-${quality}`, "-c", "--", path.resolve(input)], archive);
          times.push((performance.now() - started) / 1000);
          size = (await stat(archive)).size;
          await startProcess("xz", ["-dc", archive], restored);
          if (sha256(await readFile(restored)) !== originalHash) throw new Error("xz output failed verification.");
        }
        results.push({ name: `xz · -${quality}`, size, seconds: median(times) });
      }
    } else {
      console.log("xz is not installed; skipped (install xz to include it).\n");
    }

    if (await commandAvailable("7z", ["i"])) {
      for (const quality of QUALITIES) {
        const times = [];
        let size = 0;
        for (let trial = 0; trial < iterations; trial += 1) {
          const archive = path.join(scratch, `7z-${quality}-${trial}.7z`);
          const restored = path.join(scratch, `7z-${quality}-${trial}.out`);
          const started = performance.now();
          await startProcess("7z", [
            "a", "-t7z", "-m0=lzma2", `-mx${quality}`, "-mmt=1", "-bd", "-y",
            archive, path.resolve(input),
          ]);
          times.push((performance.now() - started) / 1000);
          size = (await stat(archive)).size;
          await startProcess("7z", ["e", "-so", "-bd", archive], restored);
          if (sha256(await readFile(restored)) !== originalHash) throw new Error("7-Zip output failed verification.");
        }
        results.push({ name: `7-Zip · LZMA2 level ${quality}`, size, seconds: median(times) });
      }
    } else {
      console.log("7-Zip is not installed; skipped (install 7-Zip to include it).\n");
    }

  const ziptastic = await (async () => {
    if (!ziptasticExecutable) return "ziptastic";
    return ziptasticExecutable;
  })();
  if (await commandAvailable(ziptastic, ["version"])) {
    const times = [];
    let size = 0;
    for (let trial = 0; trial < iterations; trial += 1) {
      const archive = path.join(scratch, `ziptastic-${trial}.dr`);
      const restored = path.join(scratch, `ziptastic-${trial}.out`);
      const started = performance.now();
      await startProcess(ziptastic, ["c", "-9", "-f", "-o", archive, path.resolve(input)]);
      times.push((performance.now() - started) / 1000);
      size = (await stat(archive)).size;
      await startProcess(ziptastic, ["d", "-f", "-o", restored, archive]);
      if (sha256(await readFile(restored)) !== originalHash) {
        throw new Error("Ziptastic output failed byte-for-byte verification.");
      }
    }
    results.push({ name: "Ziptastic · CHCE -9 (.dr)", size, seconds: median(times) });
  } else if (requestedZiptastic) {
    throw new Error(`The Ziptastic executable was not found or could not run: ${requestedZiptastic}`);
  } else {
    console.log("Ziptastic was not found on PATH; pass --ziptastic /path/to/ziptastic to include it.\n");
  }

    const labelWidth = Math.max(...results.map((result) => result.name.length), 22);
    console.log("COMPRESSION COMPARISON (median of trials)");
    console.log(`${"Method".padEnd(labelWidth)}  ${"Size".padStart(11)}  ${"Smaller".padStart(9)}  ${"Time".padStart(9)}  Speed`);
    console.log("─".repeat(labelWidth + 53));

    for (const result of results) {
      const ratio = original.length ? `${((1 - result.size / original.length) * 100).toFixed(1)}%` : "—";
      const throughput = result.seconds > 0
        ? `${((original.length / 1_000_000 / result.seconds)).toFixed(1)} MB/s`
        : "< 0.001 s";
      console.log(
        `${result.name.padEnd(labelWidth)}  ${formatBytes(result.size).padStart(11)}  ${ratio.padStart(9)}  ${(result.seconds * 1000).toFixed(1).padStart(7)} ms  ${throughput}`,
      );
    }

    console.log("\nBenchmarks measure compression time and output size only, not extraction speed.");
    console.log("7-Zip archives include container metadata; Brotli, xz, and .dr have different framing and transforms.");
    console.log("Try several representative files before drawing conclusions.");
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

export const USAGE = `Faztest — Brotli file compression, no extra packages\n\n` +
  `Usage:\n` +
  `  node faztest.mjs compress <file> [-q 0..11] [-o <file>] [--force]\n` +
  `  node faztest.mjs decompress <file.br> [-o <file>] [--force]\n` +
  `  node faztest.mjs bench <file> [-n 1..20] [--ziptastic <path>]\n\n` +
  `Examples:\n` +
  `  node faztest.mjs compress ./notes.txt\n` +
  `  node faztest.mjs decompress ./notes.txt.br\n` +
  `  node faztest.mjs bench ./notes.txt --iterations 3\n` +
  `  node faztest.mjs bench ./game-assets.tar --ziptastic ./ziptastic\n\n` +
  `Compression quality ranges from 0 (faster) to 11 (smaller, often slower); default: 5.\n` +
  `Bench runs three trials at levels 1, 5, and 9 for each installed tool.\n` +
  `Install xz and/or 7-Zip separately; put Ziptastic on PATH or pass --ziptastic <path>.`;

export async function runCli(args = process.argv.slice(2)) {
  let options;
  try {
    options = parseArgs(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid command.";
    console.error(`Faztest: ${message}\n\nRun 'node faztest.mjs --help' for usage.`);
    process.exitCode = 2;
    return;
  }

  if (options.help) {
    console.log(USAGE);
    return;
  }

  try {
    if (options.operation === "compress") await compressFile(options);
    else if (options.operation === "decompress") await decompressFile(options);
    else await benchFile(options);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    console.error(`Faztest: ${message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv[2] === "__bench-brotli") {
    try {
      const [input, output, qualityValue] = process.argv.slice(3);
      if (!input || !output || !qualityValue || !/^\d+$/.test(qualityValue)) {
        throw new Error("Invalid internal benchmark request.");
      }
      await writeFile(output, compressBuffer(await readFile(input), Number(qualityValue)));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected benchmark error.";
      console.error(`Faztest: ${message}`);
      process.exitCode = 1;
    }
  } else {
    await runCli();
  }
}