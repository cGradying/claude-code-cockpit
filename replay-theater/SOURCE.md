# Source of this plugin

This is a vendored copy, kept as close to upstream as possible.

- Upstream: https://github.com/anthropics/claude-code-playground
- Folder: `claude-code/mods/replay-theater`
- Commit: `569c5283d9`
- Licence: Apache-2.0 (see `LICENSE`, kept unchanged)
- Vendored: 2026-10-10 into the local `janvin-mods` marketplace, loaded by the `cockpit` umbrella plugin.

## Changes from upstream

- hooks/replay-theater.mjs: the AbovePrompt hook now awaits `next(e)` and stacks its hint above what other plugins draw (it used to replace them).

## Checks

No upstream tests exist. Checked with `claude plugin validate`.

## Updating

Clone upstream at a newer commit, copy the same files over this folder, re-apply the changes above, rerun `claude plugin validate` and `claude plugin test`, and update the commit here.
