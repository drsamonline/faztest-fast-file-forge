#!/usr/bin/env python3
"""check-claims.py — every number in the README table must exist in docs/FINDINGS.md.

`docs/FINDINGS.md` calls itself the single authoritative record. The README repeats its
headline rows for the one table a reader sees first, and nothing checked that the two still
agreed — a hand-copied table is exactly how a published number drifts from the measurement
behind it. This is the gate that stops that.

    python3 scripts/check-claims.py
    python3 scripts/check-claims.py --verbose

Exit 0 when every number in the README's tables matches a number in FINDINGS.md to within
0.5% (rounding: the README says 244 s where FINDINGS says 243.6 s), and non-zero otherwise.

Rows are matched by their numbers, not their labels: the README names a row "faztest -q5
(default)" where FINDINGS names it "faztest -q5", and requiring the labels to agree would fail
on wording rather than on a number.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NUM = re.compile(r"-?\d[\d,]*(?:\.\d+)?")


def numbers(text: str) -> list[float]:
    return [float(m.replace(",", "")) for m in NUM.findall(text)]


def table_rows(text: str) -> list[list[str]]:
    rows = []
    for line in text.splitlines():
        line = line.strip()
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) >= 3 and not set("".join(cells)) <= set("-: "):
            rows.append(cells)
    return rows


def main() -> int:
    verbose = "--verbose" in sys.argv
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    findings = (ROOT / "docs" / "FINDINGS.md").read_text(encoding="utf-8")
    known = numbers(findings)

    checked = 0
    missing = []
    for row in table_rows(readme):
        # The header row and the units row carry no measured figures.
        cells = [c for c in row if c and not set(c) <= set("-: ")]
        if all(c.lower() in ("setting", "archive", "ratio of raw", "time") for c in cells):
            continue
        for cell in cells[1:]:
            for value in numbers(cell):
                checked += 1
                if not any(abs(value - k) <= max(abs(k) * 0.005, 0.05) for k in known):
                    missing.append((row[0], value))
                    if verbose:
                        print("not in FINDINGS.md: %r from row %r" % (value, row[0]))

    if missing:
        print("%d of %d README numbers have no counterpart in docs/FINDINGS.md:"
              % (len(missing), checked))
        for label, value in missing:
            print("  %-28s %s" % (label, value))
        print("\nEither the README was edited by hand, or FINDINGS.md was regenerated. "
              "Re-measure and update both.")
        return 1

    print("check-claims: %d README numbers all appear in docs/FINDINGS.md" % checked)
    return 0


if __name__ == "__main__":
    sys.exit(main())
