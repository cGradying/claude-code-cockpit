# Source of this plugin

This is a vendored copy, kept as close to upstream as possible.

- Upstream: https://github.com/anthropics/claude-code-playground
- Folder: `claude-code/mods/blast-radius`
- Commit: `569c5283d9`
- Licence: Apache-2.0 (see `LICENSE`, kept unchanged)
- Vendored: 2026-10-10 into the local `janvin-mods` marketplace, loaded by the `cockpit` umbrella plugin.

## Changes from upstream

- hooks/blast-radius.mjs: the AbovePrompt hook (used only when the pane falls back to the band) now stacks above `next(e)` instead of replacing it.

## Checks

No upstream tests exist. Checked with `claude plugin validate`. Note: its migration listers run project code (manage.py, alembic, rails, prisma) in the folder the command names, before you approve.

## Updating

Clone upstream at a newer commit, copy the same files over this folder, re-apply the changes above, rerun `claude plugin validate` and `claude plugin test`, and update the commit here.
