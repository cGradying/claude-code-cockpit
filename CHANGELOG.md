# Changelog

## Unreleased

- savvy-progress `1.2.0+cockpit.2`: the progress bar and the agents panel were SVG and showed blank in the desktop app. They now use Claude's own text. The bar still appears only once a flow reports progress; `/agents-info` opens the panel any time.

## 0.3.0

- **The band is native.** The SVG card (which rendered blank in the desktop app and caused the white edge, flash and shrinking) is gone. The band is one row of Claude's own text and buttons: cache countdown, context, the next task, Continue and Details. Limits appear on it only past 60%; 9router only when it stops answering.
- **New Cockpit panel**, opened with Details or `/cockpit`: prompt cache, context, plan limits with reset times, cost, the next five tasks, and the project shortcuts, with solid percent bars that follow the app theme. Replaces the More / Back toggle.
- filetree: new `autoOpen` setting, default `off`. The tree opens with `/filetree` instead of docking itself at every session start.
- replay-theater and savvy-progress use the cockpit accent colour; replay-theater's border box is removed.
- Fixed in passing: the cockpit state contract (`tasks` added, `quickOpen` removed).

## 0.2.0 (first public release)

- **cockpit**: one-line band above the prompt (cache countdown ring, context, 5-hour and weekly limits, cost, 9router dot, next task); Continue, What's next?, More and Compact buttons; `/next`; project shortcuts from `.claude/quick.json`; guards (no Claude credit lines in shell commands, pasted API keys held once, design nudge); the `cockpit:help` skill.
- Bundles seven community mods as dependencies, at pinned commits, patched to start quiet: replay-theater, blast-radius, savvy-progress, cache-tax, claude-reflect (`reflect-mod`), filetree, skins. See `THIRD_PARTY_NOTICES.md`.
- cache-tax: new `guard` (default `warn`) and `autoWarm` (default `off`) settings.
- claude-reflect starts paused. skins starts off with its own band off.
- replay-theater, blast-radius and savvy-progress now stack their band above other plugins' instead of replacing them.
- Compact starts from a timer so releasing the click does not cancel it.
- terminal-browser was considered and left out.
