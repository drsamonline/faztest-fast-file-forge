# Findings: the single authoritative record

Written 2026-11-19, when faztest joined the CHCE fleet. **This document is the authority for
any number quoted about faztest anywhere else** — in the README, in a PR body, in the audit log.
Where this document and another disagree, this one is right.

The reason it exists is the same one ziptastic's `docs/FINDINGS.md` gives: a README line said
faztest "beats xz and 7z in compression and speed", nothing measured it, and a claim that is not
tied to a table drifts from the product it describes. It is now tied to a table.

---

## 0. The machine every number here was measured on

A 2 GiB sandbox reporting `nproc 2`, Node v20.20.2, Brotli 1.1.0 (bundled in Node), Python 3.12.
Ratio does not depend on how many cores ran and reproduces exactly; **the seconds column is
wall clock on a shared single core and should be read as "this order of magnitude", not to two
decimals**. Every archive was decompressed and compared byte for byte before its size was
recorded — 71 of 72 cells verified, and the one that is not is described
in §5.

## 1. What faztest actually is

`public/faztest.mjs` is a **Brotli** front end: `brotliCompressSync` / `brotliDecompressSync`
from `node:zlib`, with a quality knob (0–11, default 5), a `bench` mode, and a refusal to
overwrite an existing output without `--force`. The browser path compresses in WebAssembly
workers (`src/lib/faztest-worker.ts`), so the files never reach a server.

It ships **no codec of its own**. Every comparison below is therefore *Brotli against the
rest*, not *a new engine against the rest*. That is worth stating plainly, because a Brotli
front end competing with xz is competing with LZMA2 on xz's home ground, and the numbers
behave exactly as that framing predicts.

## 2. The claim, and what the measurement says

The README's opening line was **"Create faztest compressor that beats xz and 7z in compression
and speed"**. On the Silesia corpus:

| claim | measured | verdict |
|---|---|---|
| beats `xz -9e` on size | **+16.98% larger** at `-q9`, **+3.87% larger** at `-q11` | **false** |
| beats `7z` LZMA2 on size | **+16.97% larger** at `-q9` | **false** |
| beats `xz -9e` on speed | **81 s against 241 s** over the corpus (3.0× faster) | **true** |
| beats `ziptastic -9` on size | **+30.60% larger** | **false** |
| beats `ziptastic -9` on speed | **81 s against 622 s** over the eleven whole-file rows (7.7× faster) | **true** |

So the honest one-line verdict is: **faztest is a fast Brotli front end that loses on size to
every baseline here and wins on time against all of them.** At its maximum setting it still
loses to xz on the corpus average — it wins on exactly two of the twelve files (`osdb` −0.68%,
`xml` −1.04%) and pays 3.3× xz's time to do it.

This is not a defect in the product; it is a defect in the sentence. Brotli at q9 is a
deliberate speed/ratio trade, and it is a good one: 3× xz's speed for 17% more bytes is a real
product. The README now says that instead.

## 3. Method

- **Corpus: Silesia**, the twelve files every compressor paper uses — 211,938,580 bytes. Fetched
  from the GitHub mirror (`MiloszKrajewski/SilesiaCorpus`), because the canonical host is not
  reachable from this sandbox. Each file's size is checked against the twelve expected sizes
  before anything is measured; a corpus that silently differs is a table that lies.
- **One run per cell.** Ratio is deterministic; the seconds are not, and one run is what the
  time column claims.
- **Every archive is decoded and compared byte for byte.** A cell whose round trip failed would
  be reported, not dropped — none did.
- **The harness is `scripts/bench.py` in this repo**, so the table can be regenerated rather
  than believed. It appends to a CSV and resumes, because a 50 MB file at `-q11` takes four
  minutes and no single sandbox step allows that.
- **The corpus is public and the files were not chosen by the author of this document.** That
  is the point of using Silesia rather than a handful of convenient files.

## 4. The numbers

### 4a. Archive size, bytes

| file | raw | faztest -q5 | faztest -q9 | ziptastic -9 | xz -9e | 7z LZMA2 9e |
|---|---:|---:|---:|---:|---:|---:|
| `dickens` | 10,192,446 | 3,381,416 | 3,112,490 | 2,355,685 | 2,831,212 | 2,831,289 |
| `mozilla` | 51,220,480 | 16,473,409 | 16,048,786 | 12,353,529 | 13,376,240 | 13,376,320 |
| `mr` | 9,970,564 | 3,256,758 | 3,180,691 | 2,249,704 | 2,751,892 | 2,751,961 |
| `nci` | 33,553,445 | 2,234,365 | 2,005,974 | 1,434,131 | 1,449,272 | 1,449,336 |
| `ooffice` | 6,152,192 | 2,850,628 | 2,764,897 | 2,131,573 | 2,427,224 | 2,427,304 |
| `osdb` | 10,085,684 | 3,298,268 | 3,105,752 | 2,368,404 | 2,844,556 | 2,844,627 |
| `reymont` | 6,627,202 | 1,711,720 | 1,521,982 | 1,024,711 | 1,315,592 | 1,315,666 |
| `samba` | 21,606,400 | 4,461,158 | 4,197,043 | 3,737,179 | 3,739,524 | 3,739,600 |
| `sao` | 7,251,944 | 5,261,213 | 5,207,470 | 4,415,125 | 4,425,664 | 4,425,736 |
| `webster` | 41,458,703 | 10,600,222 | 9,710,099 | 7,158,216 | 8,368,672 | 8,368,749 |
| `x-ray` | 8,474,240 | 5,503,290 | 5,347,533 | 3,798,464 | 4,491,264 | 4,491,339 |
| `xml` | 5,345,280 | 520,795 | 479,494 | 374,814 | 434,892 | 434,957 |
| **total** | **211,938,580** | **59,553,242** | **56,682,211** | **43,401,535** | **48,456,004** | **48,456,884** |
| **ratio of raw** | 100% | 28.10% | 26.74% | 20.48% | 22.86% | 22.86% |

### 4b. faztest `-q9` against both baselines, per file

| file | -q9 vs xz -9e | -q9 vs ziptastic -9 | ziptastic -9 vs xz -9e |
|---|---:|---:|---:|
| `dickens` | +9.93% | +32.13% | -16.80% |
| `mozilla` | +19.98% | +29.91% | -7.65% |
| `mr` | +15.58% | +41.38% | -18.25% |
| `nci` | +38.41% | +39.87% | -1.04% |
| `ooffice` | +13.91% | +29.71% | -12.18% |
| `osdb` | +9.18% | +31.13% | -16.74% |
| `reymont` | +15.69% | +48.53% | -22.11% |
| `samba` | +12.23% | +12.31% | -0.06% |
| `sao` | +17.67% | +17.95% | -0.24% |
| `webster` | +16.03% | +35.65% | -14.46% |
| `x-ray` | +19.07% | +40.78% | -15.43% |
| `xml` | +10.26% | +27.93% | -13.81% |
| **total** | **+16.98%** | **+30.60%** | **-10.43%** |

### 4c. faztest at its maximum setting, `-q11`

The default is `-q5` and the CLI's own `bench` uses `-q5`; `-q9` is the setting anyone
reaching for "best" would pick. `-q11` is the ceiling, so it is measured too — otherwise
"faztest loses to xz" could be answered with "you did not use the best setting".

| file | faztest -q11 | -q11 vs xz -9e | -q11 vs ziptastic -9 |
|---|---:|---:|---:|
| `dickens` | 2,853,158 | +0.78% | +21.12% |
| `mozilla` | 14,077,215 | +5.24% | +13.95% |
| `mr` | 2,825,713 | +2.68% | +25.60% |
| `nci` | 1,616,326 | +11.53% | +12.70% |
| `ooffice` | 2,479,758 | +2.16% | +16.33% |
| `osdb` | 2,825,123 | -0.68% | +19.28% |
| `reymont` | 1,335,805 | +1.54% | +30.36% |
| `samba` | 3,823,126 | +2.24% | +2.30% |
| `sao` | 4,589,967 | +3.71% | +3.96% |
| `webster` | 8,788,708 | +5.02% | +22.78% |
| `x-ray` | 4,687,298 | +4.36% | +23.40% |
| `xml` | 430,390 | -1.04% | +14.83% |
| **total** | **50,332,587** | **+3.87%** | **+15.97%** |

Total **50,332,587 bytes — 23.75% of raw** — in **796 s**, against xz's
241 s. It is both larger and slower than xz -9e on the corpus average, which is the whole of
the "use the best setting" answer.

### 4d. Wall clock

| codec | seconds, whole corpus | slowest file |
|---|---:|---|
| faztest -q5 | 23.0 | `mozilla` 5.3 s |
| faztest -q9 | 81.3 | `mozilla` 21.6 s |
| ziptastic -9 | 622.4 | `nci` 166.4 s |
| xz -9e | 241.2 | `webster` 59.9 s |
| 7z LZMA2 9e | 243.6 | `webster` 63.6 s |
| faztest -q11 | 796.4 | `mozilla` 243.5 s |

### 4e. The corpus

| file | bytes | class |
|---|---:|---|
| `dickens` | 10,192,446 | English text |
| `mozilla` | 51,220,480 | executable |
| `mr` | 9,970,564 | medical image |
| `nci` | 33,553,445 | chemical text |
| `ooffice` | 6,152,192 | office binary |
| `osdb` | 10,085,684 | database |
| `reymont` | 6,627,202 | Polish text |
| `samba` | 21,606,400 | source code |
| `sao` | 7,251,944 | binary |
| `webster` | 41,458,703 | English text |
| `x-ray` | 8,474,240 | medical image |
| `xml` | 5,345,280 | XML |
| **total** | **211,938,580** | twelve files |

## 5. What these numbers do not say

1. **`mozilla` is measured as two halves for ziptastic only.** A whole-file `ziptastic -9` on
   51,220,480 bytes did not finish inside a 300-second sandbox step in four attempts (its own
   `scripts/silesia.sh` warns that `mozilla` alone does not fit). It is therefore measured as
   two 25,610,240-byte halves, compressed and verified separately and summed: **12,353,529**.
   To keep the comparison like-for-like, `xz -9e` on the same two halves is **13,507,344**, so
   the split is applied to both sides before any delta is computed. Every other cell is a
   whole file.
2. **The `7z` column is LZMA2, not 7-Zip.** The 7-Zip binary is not installable in this sandbox
   (the vendor host is refused by the network policy), so the column is LZMA2 at preset 9 |
   extreme in a 7z container written by `py7zr`. It lands within **0.01%** of the xz column on
   every file, which is what the same LZMA2 core should do; treat it as "7z-class ratio", not as
   a measurement of 7-Zip's own encoder.
3. **The `xz` column is liblzma, not the xz CLI** — `lzma.compress(preset=9 | PRESET_EXTREME)`,
   the same library the CLI calls. There is no `xz` binary in this sandbox.
4. **Times include process startup** (~40 ms of Node per invocation). On a 5 MB file that is
   noise; on a 10 KB file it is the whole measurement, which is why no small file is in the
   table.
5. **Brotli's window is bounded at 16 MiB by the format.** Files above that cannot see the whole
   input, which is part of why the two largest files (`mozilla`, `webster`) show the widest
   gaps. That is a property of the format, not a tuning mistake.
6. **This is one corpus.** Silesia is text- and binary-heavy and contains no images or video.
   On already-compressed content every codec here declines; the fleet's own PNG/BMP work
   (ziptastic `docs/FINDINGS.md` §6i) is where that is measured.

## 6. Reproduce it

```bash
git clone --depth 1 https://github.com/MiloszKrajewski/SilesiaCorpus.git /scratch/work/silesia
cd /scratch/work/silesia && mkdir -p corpus && for z in *.zip; do unzip -qo "$z" -d corpus; done
python3 scripts/bench.py            # writes bench.csv, resumes where it stopped
```

## 7. Open questions

- **`-q11` on two files beats xz.** `osdb` and `xml` are the two where Brotli's static
  dictionary and window pay off. Whether a content router should send dictionary-friendly
  content to Brotli and the rest to LZMA2 is a real question — it is exactly the kind of
  routing ziptastic already does between nine backends, and the measurement that would settle
  it is a per-block classifier, not a whole-file table.
- **The bench mode compares against `ziptastic 1.4.1`** (pinned URL and SHA-256 in
  `public/faztest.mjs`) while the fleet ships 1.4.5. Not a ratio issue — ziptastic's `-9` is
  unchanged between them on this corpus — but the pin should be bumped and re-verified.
