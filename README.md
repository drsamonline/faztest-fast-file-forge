# Faztest Fast File Forge

A Brotli front end for files you would rather not upload: compress and decompress in the
browser (WebAssembly workers, nothing leaves the machine) or from a portable CLI,
`public/faztest.mjs`.

## Measured

Silesia corpus, twelve files, 211,938,580 bytes, one run per cell, every archive decoded back
and compared byte for byte. Full tables, method and caveats: **[docs/FINDINGS.md](docs/FINDINGS.md)**
— it is the authority for every number here, and `scripts/check-claims.py` fails the build if
this table and that document disagree.

| setting | archive | ratio of raw | time |
|---|---:|---:|---:|
| faztest -q5 (default) | 59,553,242 | 28.10% | 23 s |
| faztest -q9 | 56,682,211 | 26.74% | 81 s |
| faztest -q11 | 50,332,587 | 23.75% | 796 s |
| xz -9e | 48,456,004 | 22.86% | 241 s |
| 7z LZMA2 9e | 48,456,884 | 22.86% | 244 s |
| ziptastic -9 | 43,401,535 | 20.48% | 622 s |

Read it as the product it is: **faztest is the fastest of these and the largest.** Brotli at
-q5 is three times xz's speed for 23% more bytes; at -q9 it is still three times as fast for
17% more. It does not beat xz or 7z on size at any setting, and this README used to claim it
did — the measurement is in docs/FINDINGS.md.

Times are the sum of wall clock over the corpus on one shared core. ziptastic's figure covers
the eleven files measured whole; mozilla is measured as two halves (FINDINGS.md §5).

## Command line

```sh
node public/faztest.mjs compress photo.png -q 9        # writes photo.png.br
node public/faztest.mjs decompress photo.png.br       # writes photo.png
node public/faztest.mjs bench photo.png               # against ziptastic, xz and 7z if installed
```

The CLI refuses to overwrite an existing output without `--force`, and an unknown command
exits non-zero rather than doing nothing.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
bun install
bun run dev
bun run test
```

CI runs the same three commands: `bun run test`, `scripts/check-claims.py`, and a CLI
round-trip gate. The repository ships `bun.lock` and no `package-lock.json`, so `bun install
--frozen-lockfile` is the reproducible install.
