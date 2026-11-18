## Faztest CLI
- Keep `public/faztest.mjs` as the portable local command-line compressor; browser compression and extraction run in WebAssembly workers so private files never reach the server.
- Keep external-format CLI benchmarks as directly spawned executables, and verify every archive by extracting it and comparing the original bytes.

## Fleet rules (CHCE)

faztest is a member of the CHCE fleet (ziptastic, heavenzip, HCS, kosh, lexora,
corpus-extendum, audit) and carries the same rules as the rest of it.

- **`docs/FINDINGS.md` is the authority for any number quoted anywhere else** — README, PR
  body, audit log. If a figure is not in it, it is not a finding yet.
- **A claim in the README must be a row in `docs/FINDINGS.md`.** `scripts/check-claims.py`
  enforces it in CI. The README claimed to beat xz and 7z for as long as nothing checked.
- **Measure over a corpus, never one file.** `scripts/bench.py` runs the Silesia corpus and
  verifies every round trip; a number from a file you chose is a number about that file.
- **Nothing is done until a command has run and its output has been read.** A green CI
  conclusion is not a run — read the step.
- **An unimplemented command refuses with a non-zero exit and names what it does not do.**
  Never no-op. The CLI gate in CI checks the exit code.
- **One PR per subject, conventional commits.** The PR body says what was wrong and what
  proves it fixed.
- **When a trap is hit twice, write a gate, not a paragraph.**
- **Do not rewrite published history.** No force pushing, and no rebasing, amending or
  squashing commits that are already pushed.
