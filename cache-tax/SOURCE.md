# Source of this plugin

This is a vendored copy, kept as close to upstream as possible.

- Upstream: https://github.com/karanb192/cache-tax
- Folder: `hooks/ + .claude-plugin/`
- Commit: `06cac47ec1`
- Licence: MIT (see `LICENSE`, kept unchanged)
- Vendored: 2026-10-10 into the local `janvin-mods` marketplace, loaded by the `cockpit` umbrella plugin.

## Changes from upstream

- hooks/register.ts: `register(on, options)` reads two new settings. `guard` (default warn; upstream was refuse) and `autoWarm` (default off; upstream armed a 3h keep-warm after any paid cold write). With autoWarm off, a paid cold write only extends a window you opened with /keepwarm or set to always.
- .claude-plugin/plugin.json: adds the `guard` and `autoWarm` userConfig fields.
- hooks/register.test.ts: upstream's suite, run under `{ guard: 'refuse', autoWarm: 'on' }` (upstream's behaviour), plus 3 tests of the new defaults.

## Checks

59 tests pass (56 upstream under upstream settings, 3 for the defaults).

## Updating

Clone upstream at a newer commit, copy the same files over this folder, re-apply the changes above, rerun `claude plugin validate` and `claude plugin test`, and update the commit here.
