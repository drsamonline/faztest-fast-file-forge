import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { which } from "bun";
import { afterEach, describe, expect, it } from "vitest";

const execFile = promisify(execFileCallback);
const script = path.resolve(process.cwd(), "public/faztest.mjs");
const directories: string[] = [];

async function makeWorkspace() {
  const directory = await mkdtemp(path.join(tmpdir(), "faztest-test-"));
  directories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("Faztest command-line compressor", () => {
  it("compresses a file and restores its exact bytes", async () => {
    const directory = await makeWorkspace();
    const input = path.join(directory, "notes.txt");
    const source = Buffer.from("Faztest preserves every byte.\n".repeat(45));
    await writeFile(input, source);

    await execFile(process.execPath, [script, "compress", input, "--level", "5"]);
    const archive = `${input}.br`;
    expect((await readFile(archive)).length).toBeGreaterThan(0);

    await rm(input);
    await execFile(process.execPath, [script, "decompress", archive]);
    expect(await readFile(input)).toEqual(source);
  });

  it("refuses to replace an existing output unless --force is supplied", async () => {
    const directory = await makeWorkspace();
    const input = path.join(directory, "notes.txt");
    const archive = `${input}.br`;
    await writeFile(input, "keep the original output");
    await writeFile(archive, "do not overwrite");

    await expect(execFile(process.execPath, [script, "compress", input])).rejects.toThrow(
      "Output already exists",
    );
    expect(await readFile(archive, "utf8")).toBe("do not overwrite");
  });

  it("rejects compression levels outside the supported 0–11 range", async () => {
    const directory = await makeWorkspace();
    const input = path.join(directory, "notes.txt");
    await writeFile(input, "quality is explicit");

    await expect(execFile(process.execPath, [script, "compress", input, "--level", "12"])).rejects.toThrow(
      "Quality must be a whole number from 0 to 11",
    );
  });

  it("runs a real benchmark and includes whichever installed comparison tools are available", async () => {
    const directory = await makeWorkspace();
    const input = path.join(directory, "sample.txt");
    await writeFile(input, "A fair comparison checks both size and speed.\n".repeat(12));

    const { stdout } = await execFile(process.execPath, [script, "bench", input, "--iterations", "1"]);
    expect(stdout).toContain("Faztest · Brotli q5");
    expect(stdout).toContain("COMPRESSION COMPARISON");
    if (which("xz")) expect(stdout).toContain("xz · -5");
    else expect(stdout).toContain("xz is not installed; skipped");
    if (which("7z")) expect(stdout).toContain("7-Zip · LZMA2 level 5");
    else expect(stdout).toContain("7-Zip is not installed; skipped");
    expect(stdout).toContain("median of trials");
  });
});