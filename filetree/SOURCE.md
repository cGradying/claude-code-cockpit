# Source of this plugin

This is a vendored copy, kept as close to upstream as possible.

- Upstream: https://github.com/data-goblin/claude-code-filetree
- Folder: `hooks/, types/, .claude-plugin/`
- Commit: `da1da65724`
- Licence: MIT (see `LICENSE`, kept unchanged)
- Vendored: 2026-10-10 into the local `janvin-mods` marketplace, loaded by the `cockpit` umbrella plugin.

## Changes from upstream

- Copied with tests/; scripts/, .githooks/ and .github/ left out.
- hooks/register.tsx and plugin.json: new `autoOpen` setting, default `off`, so the tree is docked only when you run /filetree (upstream docked it at session start). tests/surfaces.test.tsx: the upstream suite runs with `autoOpen: on`, plus one test for the default.

## Checks

35 of 36 tests pass (upstream's 35 plus one for the default); the one failure (`sidebar only: no pane in the default layout...`, a ui.close stub) fails identically on untouched upstream on this engine.

## Updating

Clone upstream at a newer commit, copy the same files over this folder, re-apply the changes above, rerun `claude plugin validate` and `claude plugin test`, and update the commit here.
