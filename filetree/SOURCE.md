# Source of this plugin

This is a vendored copy, kept as close to upstream as possible.

- Upstream: https://github.com/data-goblin/claude-code-filetree
- Folder: `hooks/, types/, .claude-plugin/`
- Commit: `da1da65724`
- Licence: MIT (see `LICENSE`, kept unchanged)
- Vendored: 2026-10-10 into the local `janvin-mods` marketplace, loaded by the `cockpit` umbrella plugin.

## Changes from upstream

- none. Copied unchanged (tests/ copied too; scripts/, .githooks/ and .github/ left out).

## Checks

34 of 35 upstream tests pass; the one failure (`sidebar only: no pane in the default layout...`, a ui.close stub) fails identically on untouched upstream on this engine.

## Updating

Clone upstream at a newer commit, copy the same files over this folder, re-apply the changes above, rerun `claude plugin validate` and `claude plugin test`, and update the commit here.
