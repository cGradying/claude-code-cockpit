# Developing

## Layout

```
.claude-plugin/marketplace.json     the janvin-mods marketplace
cockpit/
  .claude-plugin/plugin.json        name, version, dependencies, types
  hooks/hooks.json                  { "modules": ["./register.tsx"] }
  hooks/register.tsx                entry: calls band(), panel() and guards()
  hooks/band.tsx                    the one-line band, /next, /cockpit
  hooks/panel.tsx                   the Cockpit panel
  hooks/shared.ts                   constants and pure helpers both use
  hooks/guards.ts                   co-author guard, key catcher, design nudge
  hooks/*.test.ts(x)                tests
  types/index.d.ts                  the $.state contract
  skills/help/SKILL.md              cockpit:help
<seven vendored plugins>/           each with SOURCE.md and LICENSE
docs/                               this documentation
```

## Checking your work

Run these from the repository root. `claude plugin validate` reads a plugin the way the engine will and reports what it hooks and what it would refuse; `claude plugin test` runs the plugin's `*.test.ts(x)` files against the real engine.

```bash
claude plugin validate .                 # the marketplace
claude plugin validate cockpit           # one plugin
claude plugin test cockpit
```

Expected results: cockpit 37 tests, cache-tax 59, reflect-mod 3, skins 58, filetree 35 of 36, and replay-theater, blast-radius and savvy-progress validate with no tests (upstream ships none). The one filetree failure (`sidebar only: no pane in the default layout...`) fails identically on untouched upstream.

To try a plugin without installing it, start Claude Code with `claude --plugin-dir ./cockpit`.

## Rules the validator enforces

You will hit these if you add code:

- One hooks module per plugin; pass `on` only to functions that are defined at the top of a file of the plugin or imported from one.
- Do not register the same event twice without a matcher in one plugin.
- Every `$.state` key the code names must be declared in the types contract under the plugin's name.
- A hook that returns without calling `next` answers for itself. In `ui.render` for the band, call `next(e)` first and stack.
- Names in a module must not clash in ways the static check can see (a local called `pulse` in two places confused it once).

## Updating a vendored mod

1. Clone upstream at the new commit.
2. Copy the same files listed in the mod's `SOURCE.md` over its folder here.
3. Re-apply the changes listed in `SOURCE.md`. They are small and each is marked `cockpit patch` in the code.
4. Run `claude plugin validate` and `claude plugin test` on it. Where upstream ships tests they are part of the check: for cache-tax the suite is run under upstream's own settings (`guard: refuse`, `autoWarm: on`) so any drift shows up, and extra tests cover the quiet defaults.
5. **Read the diff** against the old commit for new process, network, file or model calls, and update [docs/SECURITY-AUDIT.md](SECURITY-AUDIT.md).
6. Update the commit in `SOURCE.md` and `THIRD_PARTY_NOTICES.md`, and add a line to `CHANGELOG.md`.

## Lessons from building the band

- Check the real test suite, not only validation. `validate` passed on a cache-tax patch that had silently commented out half a state object; the upstream tests caught it.
- Run upstream's tests against a patched copy and against untouched upstream. Failures that appear in both are not yours.
- Look at the real window. A band that passed every test rendered blank in the desktop app. Capture the window (`screencapture -l <window id>` on macOS), read it, and read the engine's own messages in the transcript.
- Prefer the app's own elements to a drawn picture. An embedded SVG frame caused a white edge, a black flash and a width that shrank; native `Box`, `Text` and `Button` have none of those.
- Keep every label one string. JSX splits `{pct}%` into separate children, which breaks text search and screen readers.
- A bar's width must be a whole percentage, or the engine refuses the whole tree.

## Trying a change in the live app

Hot reloading in a dev folder shows a change in the running desktop app. Copy `cockpit/` to `~/.claude/dev-mods/<session>/cockpit-dev`, rename the plugin and its state, pane id and command names so it does not clash with an installed copy, answer the hot-reload question once, and each turn's edits reload when the turn ends.
