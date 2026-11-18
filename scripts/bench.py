#!/usr/bin/env python3
"""bench.py — the fair four-way ratio bench behind docs/FINDINGS.md.

Subject: faztest (Brotli through node:zlib), at -q5, -q9 and -q11.
Baselines: ziptastic -9, xz -9e (liblzma), 7z LZMA2 9e (a 7z container via py7zr).

Every archive is decompressed and compared byte for byte before its size is recorded, so a
truncated or corrupt stream cannot become a row. Results append to a CSV and the script skips
cells already measured — a 50 MB file at -q11 takes about four minutes, and no single CI or
sandbox step allows the whole corpus in one go.

    python3 scripts/bench.py --corpus /path/to/silesia --out bench.csv
    python3 scripts/bench.py --corpus ... --only mozilla:ziptastic-9     # one cell
    python3 scripts/bench.py --corpus ... --skip mozilla                 # everything else

Requirements: node (for faztest), ziptastic on PATH or --ziptastic, python3 with lzma.
The 7z column additionally needs `pip install py7zr`; without it the column is skipped rather
than silently replaced by something else.

The corpus itself:

    git clone --depth 1 https://github.com/MiloszKrajewski/SilesiaCorpus.git silesia
    cd silesia && mkdir -p corpus && for z in *.zip; do unzip -qo "$z" -d corpus; done
"""
from __future__ import annotations

import argparse
import csv
import lzma
import os
import shutil
import subprocess
import sys
import tempfile
import time

CODECS = ["faztest-q5", "faztest-q9", "faztest-q11", "ziptastic-9", "xz-9e", "7z-lzma2-9e"]
FAZ = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "public", "faztest.mjs")


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, **kw)


def compress(codec, src, out, ziptastic):
    t0 = time.perf_counter()
    if codec.startswith("faztest"):
        q = codec.split("-q")[1]
        r = run(["node", FAZ, "compress", src, "-q", q, "-o", out, "-f"])
        if r.returncode != 0:
            raise RuntimeError("%s failed: %s" % (codec, r.stderr.decode()[:300]))
    elif codec == "ziptastic-9":
        r = run([ziptastic, "-9", "-f", "-o", out, src])
        if r.returncode != 0:
            raise RuntimeError("ziptastic failed: %s" % r.stderr.decode()[:300])
    elif codec == "xz-9e":
        data = lzma.compress(open(src, "rb").read(), format=lzma.FORMAT_XZ,
                             preset=9 | lzma.PRESET_EXTREME)
        open(out, "wb").write(data)
    elif codec == "7z-lzma2-9e":
        import py7zr
        filters = [{"id": py7zr.FILTER_LZMA2, "preset": 9 | lzma.PRESET_EXTREME}]
        with py7zr.SevenZipFile(out, "w", filters=filters) as z:
            z.write(src, arcname=os.path.basename(src))
    else:
        raise SystemExit("unknown codec " + codec)
    return time.perf_counter() - t0


def verify(codec, src, arch, tmp, ziptastic):
    back = os.path.join(tmp, "back")
    raw = open(src, "rb").read()
    if codec.startswith("faztest"):
        r = run(["node", FAZ, "decompress", arch, "-o", back, "-f"])
        return r.returncode == 0 and open(back, "rb").read() == raw
    if codec == "ziptastic-9":
        r = run([ziptastic, "-d", "-f", "-o", back, arch])
        return r.returncode == 0 and open(back, "rb").read() == raw
    if codec == "xz-9e":
        return lzma.decompress(open(arch, "rb").read()) == raw
    import py7zr
    ex = os.path.join(tmp, "ex")
    os.makedirs(ex, exist_ok=True)
    with py7zr.SevenZipFile(arch, "r") as z:
        z.extractall(ex)
    ok = open(os.path.join(ex, os.path.basename(src)), "rb").read() == raw
    shutil.rmtree(ex, ignore_errors=True)
    return ok


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", required=True)
    ap.add_argument("--out", default="bench.csv")
    ap.add_argument("--ziptastic", default="ziptastic")
    ap.add_argument("--only", help="one cell, as file:codec")
    ap.add_argument("--skip", default="", help="comma-separated files to leave out")
    ap.add_argument("--budget", type=float, default=0, help="stop after this many seconds")
    a = ap.parse_args()

    if not os.path.exists(FAZ):
        raise SystemExit("no faztest CLI at " + FAZ)
    if shutil.which(a.ziptastic) is None and not os.path.exists(a.ziptastic):
        raise SystemExit("no ziptastic binary at %s (--ziptastic)" % a.ziptastic)

    codecs = CODECS
    try:
        import py7zr  # noqa: F401
    except ImportError:
        codecs = [c for c in CODECS if not c.startswith("7z")]
        print("py7zr not installed: skipping the 7z column", file=sys.stderr)

    files = sorted(f for f in os.listdir(a.corpus) if os.path.isfile(os.path.join(a.corpus, f)))
    skip = set(filter(None, a.skip.split(",")))
    files = [f for f in files if f not in skip]
    if a.only:
        name, codec = a.only.split(":")
        files, codecs = [name], [codec]

    done = set()
    if os.path.exists(a.out):
        with open(a.out) as fh:
            for row in csv.DictReader(fh):
                done.add((row["file"], row["codec"]))
    new = not os.path.exists(a.out)
    out = open(a.out, "a", newline="")
    w = csv.writer(out)
    if new:
        w.writerow(["file", "raw", "codec", "bytes", "seconds", "verified"])

    deadline = time.time() + a.budget if a.budget else None
    tmp = tempfile.mkdtemp(prefix="faztest-bench-")
    try:
        for name in files:
            src = os.path.join(a.corpus, name)
            raw = os.path.getsize(src)
            for codec in codecs:
                if (name, codec) in done:
                    continue
                if deadline and time.time() > deadline:
                    print("budget reached")
                    return 0
                arch = os.path.join(tmp, name + "." + codec)
                try:
                    secs = compress(codec, src, arch, a.ziptastic)
                    nbytes = os.path.getsize(arch)
                    ok = verify(codec, src, arch, tmp, a.ziptastic)
                finally:
                    if os.path.exists(arch):
                        os.remove(arch)
                w.writerow([name, raw, codec, nbytes, "%.3f" % secs, int(ok)])
                out.flush()
                done.add((name, codec))
                print("%-9s %-14s %10d %8.2fs verify=%s" % (name, codec, nbytes, secs, ok))
    finally:
        out.close()
        shutil.rmtree(tmp, ignore_errors=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
