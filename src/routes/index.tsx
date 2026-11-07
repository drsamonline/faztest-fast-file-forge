import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  ArrowRightLeft,
  Check,
  Clipboard,
  FileArchive,
  Gauge,
  HardDriveDownload,
  Terminal,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Operation = "compress" | "decompress" | "benchmark";

const OPERATIONS: { id: Operation; label: string; icon: typeof FileArchive }[] = [
  { id: "compress", label: "Compress", icon: FileArchive },
  { id: "decompress", label: "Decompress", icon: ArrowRightLeft },
  { id: "benchmark", label: "Benchmark", icon: Gauge },
];

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Faztest — Brotli file compressor & benchmark" },
      {
        name: "description",
        content:
          "Download Faztest, a dependency-free Node.js Brotli file compressor with a built-in benchmark for Brotli, xz, and 7-Zip.",
      },
      { property: "og:title", content: "Faztest — Brotli file compressor & benchmark" },
      {
        property: "og:description",
        content:
          "A standalone Node.js Brotli compressor and a practical side-by-side benchmark for your own files.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Faztest,
});

function Faztest() {
  const [operation, setOperation] = useState<Operation>("compress");
  const [input, setInput] = useState("./your-file.txt");
  const [quality, setQuality] = useState(5);
  const [copied, setCopied] = useState(false);

  const command = `node ./faztest.mjs ${operation === "benchmark" ? "bench" : operation} ${shellQuote(input || "./your-file.txt")}${operation === "compress" ? ` --level ${quality}` : ""}`;

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="min-h-screen bg-background font-sans text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-[1056px] items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <a href="#home" className="flex items-center gap-2.5" aria-label="Faztest home">
            <span className="flex size-9 items-center justify-center rounded-sm bg-primary text-primary-foreground">
              <Zap aria-hidden="true" className="size-[18px]" />
            </span>
            <span className="text-[19px] font-bold tracking-normal">Faztest</span>
            <span className="hidden border-l border-border pl-2.5 text-xs text-muted-foreground sm:block">
              COMPRESSION LAB
            </span>
          </a>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <a href="/faztest.mjs" download="faztest.mjs">
              <ArrowDownToLine aria-hidden="true" />
              Download CLI
            </a>
          </Button>
        </div>
      </header>

      <div id="home" className="mx-auto max-w-[1056px] px-5 pb-14 pt-10 sm:px-8 sm:pt-14">
        <section aria-labelledby="page-title" className="grid gap-7 md:grid-cols-[1.2fr_0.8fr] md:items-end">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 font-mono text-xs font-medium text-primary">
              <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
              AN INDEPENDENT COMPRESSION TOOL
            </div>
            <h1
              id="page-title"
              className="max-w-xl text-[42px] leading-[1.04] font-semibold tracking-normal sm:text-[54px]"
            >
              Smaller files.
              <br />
              <span className="text-primary">Measured honestly.</span>
            </h1>
            <p className="mt-5 max-w-lg text-[16px] leading-7 text-muted-foreground">
              Meet Faztest: a tiny, standalone Brotli compressor. Benchmark real files against xz
              and 7-Zip—because no format wins on every file, size, and speed.
            </p>
          </div>

          <div className="flex gap-6 border-t border-border pt-5 md:justify-end md:border-t-0 md:pb-1 md:pl-5">
            <div>
              <p className="font-mono text-[11px] text-muted-foreground">FORMAT</p>
              <p className="mt-1 text-sm font-medium">Standard Brotli</p>
            </div>
            <div className="border-l border-border pl-6">
              <p className="font-mono text-[11px] text-muted-foreground">DEPENDENCIES</p>
              <p className="mt-1 text-sm font-medium">Node.js only</p>
            </div>
            <div className="border-l border-border pl-6">
              <p className="font-mono text-[11px] text-muted-foreground">PRICE</p>
              <p className="mt-1 text-sm font-medium">Free · open source</p>
            </div>
          </div>
        </section>

        <section className="mt-10 border-t border-border pt-7" aria-labelledby="terminal-title">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-xs text-muted-foreground">01 / COMMAND BUILDER</p>
              <h2 id="terminal-title" className="mt-2 text-2xl font-semibold tracking-normal">
                Your file, your machine.
              </h2>
            </div>
            <Terminal aria-hidden="true" className="mb-1 size-5 text-primary" />
          </div>

          <div className="border-y border-border py-5">
            <label htmlFor="file-path" className="mb-2 block text-sm font-medium">
              File path <span className="font-normal text-muted-foreground">(stays on your computer)</span>
            </label>
            <Input
              id="file-path"
              aria-label="Local file path"
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="./your-file.txt"
              className="max-w-lg font-mono"
            />
            <div className="mt-5 flex flex-wrap items-center gap-2" aria-label="Command">
              {OPERATIONS.map(({ id, label, icon: Icon }) => (
                <Button
                  key={id}
                  type="button"
                  size="sm"
                  variant={operation === id ? "default" : "outline"}
                  aria-pressed={operation === id}
                  onClick={() => setOperation(id)}
                >
                  <Icon aria-hidden="true" />
                  {label}
                </Button>
              ))}
              {operation === "compress" && (
                <div className="ml-0 flex items-center gap-2 sm:ml-3">
                  <span className="text-xs text-muted-foreground">Quality</span>
                  {[1, 5, 9].map((level) => (
                    <Button
                      key={level}
                      type="button"
                      size="sm"
                      variant={quality === level ? "secondary" : "ghost"}
                      aria-label={`Set compression quality to ${level}`}
                      aria-pressed={quality === level}
                      onClick={() => setQuality(level)}
                      className="min-w-9 px-2 font-mono"
                    >
                      {level}
                    </Button>
                  ))}
                  <span className="hidden text-xs text-muted-foreground sm:block">default: 5</span>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-hidden border-x border-b border-terminal bg-terminal">
            <div className="flex items-center justify-between border-b border-terminal-edge px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2 font-mono text-[11px] text-terminal-muted">
                <span className="size-1.5 rounded-full bg-signal" aria-hidden="true" />
                FAZTEST · SHELL
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                title={copied ? "Copied" : "Copy command"}
                aria-label={copied ? "Command copied" : "Copy command"}
                onClick={copyCommand}
                className="text-terminal-foreground hover:text-terminal-foreground"
              >
                {copied ? <Check aria-hidden="true" /> : <Clipboard aria-hidden="true" />}
                <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
              </Button>
            </div>
            <div className="min-h-[92px] overflow-x-auto px-4 py-5 sm:px-5">
              <code className="block min-w-max font-mono text-[13px] leading-6 sm:text-sm">
                <span className="select-none pr-2 text-signal">$</span>
                <span className="text-terminal-foreground">{command}</span>
              </code>
              <p className="mt-2 font-mono text-xs text-terminal-muted">
                {operation === "compress"
                  ? `Writes ${input.trim() ? shellQuote(`${input}.br`) : "<file>.br"} · quality ${quality} · lossless`
                  : operation === "decompress"
                    ? "Restores the original file · lossless"
                    : "Tests Faztest, xz, and 7-Zip where installed · 3 trials"}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-9 grid gap-8 border-t border-border pt-7 md:grid-cols-[1fr_1fr]" aria-label="Get started">
          <div>
            <p className="font-mono text-xs text-muted-foreground">02 / GET STARTED</p>
            <h2 className="mt-2 text-xl font-semibold tracking-normal">Ready in two commands.</h2>
            <div className="mt-4 grid gap-3 font-mono text-xs sm:text-[13px]">
              <div className="flex min-w-0 items-baseline gap-3">
                <span className="shrink-0 text-muted-foreground">01</span>
                <code className="break-all text-foreground">node faztest.mjs compress ./photo.jpg</code>
              </div>
              <div className="flex min-w-0 items-baseline gap-3">
                <span className="shrink-0 text-muted-foreground">02</span>
                <code className="break-all text-foreground">node faztest.mjs bench ./photo.jpg</code>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Download the script above, put it beside your file, then run either command in your
              terminal. The benchmark skips tools you don’t have installed.
            </p>
          </div>

          <div className="border-l border-border pl-0 md:pl-8">
            <p className="font-mono text-xs text-muted-foreground">03 / FAIR COMPARISON</p>
            <h2 className="mt-2 text-xl font-semibold tracking-normal">One file, one computer.</h2>
            <ul className="mt-4 grid gap-3 text-sm leading-6 text-muted-foreground">
              <li className="flex gap-2.5">
                <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" />
                See compression size and speed separately.
              </li>
              <li className="flex gap-2.5">
                <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" />
                Compare Brotli, xz, and 7-Zip on your own data.
              </li>
              <li className="flex gap-2.5">
                <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" />
                Files stay local; results vary by data and settings.
              </li>
            </ul>
          </div>
        </section>

        <footer className="mt-9 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 text-xs text-muted-foreground">
          <span className="flex items-center gap-2 font-mono">
            <HardDriveDownload aria-hidden="true" className="size-4" />
            FAZTEST · BROTLI FILE COMPRESSION
          </span>
          <span className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            Honest benchmarks, no universal winners.
          </span>
        </footer>
      </div>
    </main>
  );
}