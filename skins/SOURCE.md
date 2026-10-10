# Source of this plugin

This is a vendored copy, kept as close to upstream as possible.

- Upstream: https://github.com/hellosverre/claude-skins
- Folder: `hooks/, skills/, types/, .claude-plugin/`
- Commit: `e019c98e6d`
- Licence: MIT (see `LICENSE`, kept unchanged)
- Vendored: 2026-10-10 into the local `janvin-mods` marketplace, loaded by the `cockpit` umbrella plugin.

## Changes from upstream

- hooks/themes/monokai.ts, hooks/themes/index.ts: added a `monokai` built-in skin (Monokai palette). Not in upstream.

- hooks/command.ts: adds START_PREFS (skin off, band off) and uses it as the parsePrefs fallback, so a first run draws nothing until you run /skin. DEFAULT_PREFS is unchanged, so `/skin on` still goes to noir.
- tests/logic.test.ts, tests/rows.test.tsx: setup adapted to the new start state (rendering tests seed upstream's default prefs; fallback tests expect START_PREFS) and one test added for the start state.

## Checks

58 tests pass.

## Updating

Clone upstream at a newer commit, copy the same files over this folder, re-apply the changes above, rerun `claude plugin validate` and `claude plugin test`, and update the commit here.
