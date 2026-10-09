# Changelog

## 0.2.0 (first public release)

- **cockpit**: one-line band above the prompt (cache countdown ring, context, 5-hour and weekly limits, cost, 9router dot, next task); Continue, What's next?, More and Compact buttons; `/next`; project shortcuts from `.claude/quick.json`; guards (no Claude credit lines in shell commands, pasted API keys held once, design nudge); the `cockpit:help` skill.
- Bundles seven community mods as dependencies, at pinned commits, patched to start quiet: replay-theater, blast-radius, savvy-progress, cache-tax, claude-reflect (`reflect-mod`), filetree, skins. See `THIRD_PARTY_NOTICES.md`.
- cache-tax: new `guard` (default `warn`) and `autoWarm` (default `off`) settings.
- claude-reflect starts paused. skins starts off with its own band off.
- replay-theater, blast-radius and savvy-progress now stack their band above other plugins' instead of replacing them.
- Compact starts from a timer so releasing the click does not cancel it.
- terminal-browser was considered and left out.
