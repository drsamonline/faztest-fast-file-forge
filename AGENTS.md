<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Faztest CLI
- Keep `public/faztest.mjs` as the portable local command-line compressor; browser compression and extraction run in WebAssembly workers so private files never reach the server.
- Keep external-format CLI benchmarks as directly spawned executables, and verify every archive by extracting it and comparing the original bytes.

## Fleet rules (CHCE)

faztest is a member of the CHCE fleet (ziptastic, heavenzip, HCS, kosh, lexora,
corpus-extendum, audit) and carries the same rules as the rest of it. The Lovable block above
still governs everything it names; these govern the code and the numbers.

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
- **Do not rewrite published history.** The Lovable block forbids it, and so does the fleet.
