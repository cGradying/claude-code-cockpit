# Source of this plugin

This is a vendored copy, kept as close to upstream as possible.

- Upstream: https://github.com/JohnnyVizz/claude-kit
- Folder: `plugins/savvy-progress`
- Commit: `272a877f39`
- Licence: MIT (see `LICENSE`, kept unchanged)
- Vendored: 2026-10-10 into the local `janvin-mods` marketplace, loaded by the `cockpit` umbrella plugin.

## Changes from upstream

- hooks/register.tsx: the AbovePrompt hook awaits `next(e)` and stacks its bar above it (it used to return without calling next).
- hooks/register.tsx: the SVG branches (bar above the prompt and agents panel) are switched off, because SVG renders blank in the desktop app. The native Box/Text versions are used instead.
- hooks/register.tsx: the accent colour is the cockpit clay (#d97757) instead of purple.

## Checks

No upstream tests exist. Checked with `claude plugin validate`. It only shows once a flow reports progress or a savvy-* worker starts.

## Updating

Clone upstream at a newer commit, copy the same files over this folder, re-apply the changes above, rerun `claude plugin validate` and `claude plugin test`, and update the commit here.
