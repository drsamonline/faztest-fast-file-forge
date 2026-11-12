import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Check,
  FileArchive,
  FolderOpen,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Mode = "compress" | "decompress" | "benchmark";
type BrowserBenchmark = { quality: number; bytes: number; milliseconds: number; reduction: number };

const ZITPASTIC_LINUX_RELEASE =
  "https://github.com/drsamonline/ziptastic/releases/download/v1.4.1/ziptastic-1.4.1-linux-x86_64";
const MAX_FILE_BYTES = 128 * 1024 * 1024;

function formatBytes(bytes: number) {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(1)} kB`;
  return `${(bytes / 1_000_000).toFixed(2)} MB`;
}

function defaultOutputName(file: File, mode: Mode) {
  if (mode === "decompress" && file.name.toLowerCase().endsWith(".br")) {
    return file.name.slice(0, -3) || "restored-file";
  }
  if (mode === "decompress") return `${file.name}.restored`;
  return `${file.name}.br`;
}

export function FaztestBrowserWorkbench() {
  const [mode, setMode] = useState<Mode>("compress");
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [download, setDownload] = useState<{ blob: Blob; name: string } | null>(null);
  const [benchmark, setBenchmark] = useState<BrowserBenchmark[] | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const selectFile = useCallback((candidate: File | null | undefined) => {
    if (!candidate) return;
    setError("");
    setDownload(null);
    setBenchmark(null);
    if (candidate.size > MAX_FILE_BYTES) {
      setError("For reliable in-browser processing, choose a file smaller than 128 MB.");
      return;
    }
    setFile(candidate);
  }, []);

  async function runOperation() {
    if (!file) {
      inputRef.current?.click();
      return;
    }
    setBusy(true);
    setError("");
    setDownload(null);
    setBenchmark(null);

    try {
      const worker = new Worker(new URL("../lib/faztest-worker.ts", import.meta.url), {
        type: "module",
      });
      workerRef.current = worker;
      const buffer = await file.arrayBuffer();

      const result = await new Promise<{
        output: ArrayBuffer;
        results?: BrowserBenchmark[];
      }>((resolve, reject) => {
        worker.onmessage = (event: MessageEvent<{
          type: "complete" | "error";
          output?: ArrayBuffer;
          results?: BrowserBenchmark[];
          message?: string;
        }>) => {
          const response = event.data;
          if (response.type === "error") reject(new Error(response.message ?? "Compression failed."));
          else if (response.output) resolve({ output: response.output, results: response.results });
          else reject(new Error("The selected file could not be processed."));
        };
        worker.onerror = (event) => reject(new Error(event.message || "The local compression worker failed."));
        worker.postMessage({
          type: mode,
          buffer,
          quality: mode === "benchmark" ? 5 : quality,
        }, [buffer]);
      });

      if (mode === "benchmark") {
        setBenchmark(result.results ?? []);
      } else {
        const name = defaultOutputName(file, mode);
        setDownload({ blob: new Blob([result.output]), name });
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to process this file.");
    } finally {
      workerRef.current?.terminate();
      workerRef.current = null;
      setBusy(false);
    }
  }

  function saveResult() {
    if (!download) return;
    const url = URL.createObjectURL(download.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = download.name;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const modes: { id: Mode; label: string }[] = [
    { id: "compress", label: "Compress" },
    { id: "decompress", label: "Decompress" },
    { id: "benchmark", label: "Compare quality" },
  ];

  const fileLabel = mode === "decompress" ? ".br file" : "your file";
  const ziptasticDownloaded = mode === "benchmark"
    ? "Download the verified Ziptastic v1.4.1 executable, then compare it against xz and 7-Zip using Faztest’s command-line benchmark."
    : "Run the command-line version below to compress or restore Ziptastic’s separate .dr format.";

  return (
    <section aria-labelledby="workbench-title" className="mt-10 border-t border-border pt-7">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-muted-foreground">01 / IN-BROWSER WORKBENCH</p>
          <h2 id="workbench-title" className="mt-2 text-2xl font-semibold tracking-normal">
            Compress it. Right here.
          </h2>
        </div>
        <ShieldCheck aria-hidden="true" className="mb-1 size-5 shrink-0 text-primary" />
      </div>

      <div className="grid border-y border-border md:grid-cols-[1fr_0.86fr]">
        <div className="py-5 md:pr-8">
          <label
            htmlFor="faztest-file"
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              selectFile(event.dataTransfer.files.item(0) ?? undefined);
            }}
            className={`flex min-h-[110px] cursor-pointer flex-col items-center justify-center gap-2 border border-dashed px-4 py-4 text-center transition-colors ${dragging ? "border-primary bg-accent" : "border-border hover:border-ring"}`}
          >
            <span className="flex size-8 items-center justify-center border border-border bg-background">
              <FolderOpen aria-hidden="true" className="size-4 text-primary" />
            </span>
            <span className="text-sm font-medium">
              {file ? file.name : `Choose or drop ${fileLabel}`}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {file ? formatBytes(file.size) : "Your file never leaves this device · up to 128 MB"}
            </span>
            <Input
              ref={inputRef}
              id="faztest-file"
              aria-label="Choose a file to compress, extract, or benchmark locally"
              type="file"
              accept={mode === "decompress" ? ".br,application/octet-stream,*/*" : undefined}
              onChange={(event) => selectFile(event.currentTarget.files?.item(0) ?? undefined)}
              className="sr-only"
              tabIndex={-1}
            />
          </label>

          <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Compression action">
            {modes.map(({ id, label }) => (
              <Button
                key={id}
                type="button"
                size="sm"
                variant={mode === id ? "default" : "outline"}
                aria-pressed={mode === id}
                disabled={busy}
                onClick={() => {
                  setMode(id);
                  setError("");
                  setDownload(null);
                  setBenchmark(null);
                }}
              >
                {id === "compress" ? <FileArchive aria-hidden="true" /> : null}
                {id === "benchmark" ? <Activity aria-hidden="true" /> : null}
                {label}
              </Button>
            ))}

            {mode === "compress" && (
              <div className="ml-0 flex items-center gap-1 sm:ml-3">
                <span className="mr-1 text-xs text-muted-foreground">Quality</span>
                {[1, 5, 9].map((level) => (
                  <Button
                    key={level}
                    type="button"
                    size="sm"
                    variant={quality === level ? "secondary" : "ghost"}
                    aria-label={`Choose Brotli compression quality ${level}`}
                    aria-pressed={quality === level}
                    disabled={busy}
                    onClick={() => setQuality(level)}
                    className="min-w-8 px-2 font-mono"
                  >
                    {level}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button type="button" onClick={() => void runOperation()} disabled={busy || !file}>
              {busy ? (
                <Activity aria-hidden="true" className="animate-pulse" />
              ) : (
                <Zap aria-hidden="true" />
              )}
              {busy
                ? "Working locally…"
                : mode === "compress"
                  ? `Compress at quality ${quality}`
                  : mode === "decompress"
                    ? "Restore original"
                    : "Compare levels 1, 5, 9"}
              {!busy && <ArrowRight aria-hidden="true" />}
            </Button>
            {file && !busy && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove selected file"
                title="Remove selected file"
                onClick={() => {
                  setFile(null);
                  setDownload(null);
                  setBenchmark(null);
                  setError("");
                  if (inputRef.current) inputRef.current.value = "";
                }}
              >
                <X aria-hidden="true" />
              </Button>
            )}
          </div>

          {error && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          )}

          {download && (
            <div
              role="status"
              className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-border bg-accent px-3 py-3"
            >
              <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <Check aria-hidden="true" className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 break-all">
                  {download.name} · {formatBytes(download.blob.size)}
                </span>
              </span>
              <Button type="button" size="sm" onClick={saveResult}>
                <ArrowDownToLine aria-hidden="true" />
                Save file
              </Button>
            </div>
          )}

          {benchmark && (
            <div aria-label="Verified compression benchmark results" className="mt-5">
              <p className="mb-2 font-mono text-[11px] text-muted-foreground">
                BROTLI · EXACT-RESTORE VERIFIED · SINGLE TRIAL
              </p>
              <div className="grid grid-cols-[1fr_auto_auto_auto] border-y border-border text-xs">
                <span className="py-2 pr-3 font-medium">Quality</span>
                <span className="py-2 px-2 text-right font-medium">Size</span>
                <span className="py-2 px-2 text-right font-medium">Smaller</span>
                <span className="py-2 pl-2 text-right font-medium">Time</span>
                {benchmark.map((result) => (
                  <div key={result.quality} className="contents">
                    <span className="border-t border-border py-2 pr-3 font-mono">
                      Brotli q{result.quality}
                    </span>
                    <span className="border-t border-border py-2 px-2 text-right tabular-nums">
                      {formatBytes(result.bytes)}
                    </span>
                    <span className="border-t border-border py-2 px-2 text-right tabular-nums">
                      {result.reduction.toFixed(1)}%
                    </span>
                    <span className="border-t border-border py-2 pl-2 text-right tabular-nums">
                      {result.milliseconds.toFixed(1)} ms
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Local Brotli quality comparison. For 7-Zip, xz, and Ziptastic, use the native CLI
                benchmark below.
              </p>
            </div>
          )}
        </div>

        <aside className="border-t border-border py-5 md:border-l md:border-t-0 md:pl-8">
          <div className="flex items-center gap-2 text-sm font-medium">
            <LockKeyhole aria-hidden="true" className="size-4 text-primary" />
            All local. No uploads.
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Your selected file is compressed or restored on your device. Only the new result is
            offered for download.
          </p>
          <div className="my-4 border-t border-border" />
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles aria-hidden="true" className="size-4 text-secondary-foreground" />
            Ziptastic, verified.
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Includes your published Ziptastic v1.4.1 Linux x86-64 binary in native CLI
            Its special <span className="font-mono text-foreground">.dr</span> format
            and archive-aware transforms are measured separately from Brotli.
          </p>
          <Button asChild type="button" variant="outline" size="sm" className="mt-3">
            <a href={ZITPASTIC_LINUX_RELEASE} target="_blank" rel="noreferrer">
              <ArrowDownToLine aria-hidden="true" />
              Get Ziptastic for Linux x64
            </a>
          </Button>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {ziptasticDownloaded}
          </p>
        </aside>
      </div>
    </section>
  );
}