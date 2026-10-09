# Source of this plugin

This is a vendored copy, kept as close to upstream as possible.

- Upstream: https://github.com/BayramAnnakov/claude-reflect
- Folder: `mod/`
- Commit: `b6c4232690`
- Licence: MIT (see `LICENSE`, kept unchanged)
- Vendored: 2026-10-10 into the local `janvin-mods` marketplace, loaded by the `cockpit` umbrella plugin.

## Changes from upstream

- hooks/register.tsx: starts paused. The model check runs only after `/reflect-pause` has resumed it (store `paused` must be false); an explicit `remember:` rule still works while paused since it needs no model.
- hooks/cockpit.test.tsx: 3 tests of the paused start. Upstream's reflect.test.tsx is not shipped (it assumes the unpaused start).

## Checks

3 tests pass. Only the `mod/` folder is used, not the Python plugin (upstream says to pick one).

## Updating

Clone upstream at a newer commit, copy the same files over this folder, re-apply the changes above, rerun `claude plugin validate` and `claude plugin test`, and update the commit here.
