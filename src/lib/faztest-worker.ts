import brotliWasmPromise from "brotli-wasm";

type WorkerMessage = {
  type: "compress" | "decompress" | "benchmark";
  buffer: ArrayBuffer;
  quality: number;
};

type BenchmarkResult = {
  quality: number;
  bytes: number;
  milliseconds: number;
  reduction: number;
};

type WorkerResult = {
  type: "complete";
  operation: WorkerMessage["type"];
  output: ArrayBuffer;
  results?: BenchmarkResult[];
} | {
  type: "error";
  message: string;
};

function equalBytes(first: Uint8Array, second: Uint8Array) {
  if (first.length !== second.length) return false;
  for (let index = 0; index < first.length; index += 1) {
    if (first[index] !== second[index]) return false;
  }
  return true;
}

function transferable(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

globalThis.addEventListener("message", async (event: MessageEvent<WorkerMessage>) => {
  try {
    const brotli = await brotliWasmPromise;
    const { buffer, type, quality } = event.data;
    const source = new Uint8Array(buffer);
    let output: Uint8Array;
    let results: BenchmarkResult[] | undefined;

    if (type === "compress") {
      output = brotli.compress(source, { quality });
    } else if (type === "decompress") {
      output = brotli.decompress(source);
    } else {
      results = [];
      for (const level of [1, 5, 9]) {
        const started = performance.now();
        const compressed = brotli.compress(source, { quality: level });
        const milliseconds = performance.now() - started;
        if (!equalBytes(brotli.decompress(compressed), source)) {
          throw new Error(`Brotli quality ${level} did not restore every byte.`);
        }
        results.push({
          quality: level,
          bytes: compressed.byteLength,
          milliseconds,
          reduction: source.length === 0 ? 0 : ((source.length - compressed.byteLength) / source.length) * 100,
        });
        if (level === 5) output = compressed;
      }
      output ??= brotli.compress(source, { quality: 5 });
    }

    const response: WorkerResult = {
      type: "complete",
      operation: type,
      output: transferable(output),
      ...(results === undefined ? {} : { results }),
    };
    globalThis.postMessage(response, [response.output]);
  } catch (error) {
    const response: WorkerResult = {
      type: "error",
      message: error instanceof Error ? error.message : "Faztest could not process this file.",
    };
    globalThis.postMessage(response);
  }
});