# Changelog

## 0.5.1

- **Git panel redesigned like VS Code's Source Control**: a green status bar with the branch and `↑ahead ↓behind`, a commit message box (Enter commits everything with exactly that message), a Changes list with VS Code's letters (`M` modified, `A` added, `D` deleted, `U` new, `R` renamed), a Graph of the last 12 commits with short times and one ref each, and folding sections with square counts. Your folds are remembered. The worktree list marks the one you are in.
- Long commit subjects and branch names are cut with an ellipsis instead of wrapping.

## 0.5.0

- **Git panel**: `/git` or the `[ Git ]` button on the band opens a second panel. It shows the branch (clean or how many staged, changed and new files, ahead and behind), your open pull requests with stacked ones indented in merge order and a checks mark each, the worktrees with the merged ones flagged, and a Tidy up button for what already landed. Buttons (Commit, Push, Open PR, Sync, Merge, Tidy up) send a prompt to Claude, so you see every command and the permission prompts still apply. The panel itself only reads (`git`, and `gh` for pull requests).
- **Pixel look**: controls are text, `[ Continue ]`, not rounded buttons; the panel header is a pixel-art prompt mark with a block cursor; bars are square. The desktop still draws its own window, sidebar and message bubbles, which a mod cannot restyle.
- **Skins go square and pixel**: cards and labels have square corners and crisp edges, the tool icons are 8 by 8 pixel bitmaps, and the spinners are stepped blocks instead of circles and arcs. This applies to every skin.
- The old hot-reload test copy that doubled the band is removed.

## 0.4.0

- **`/skin monokai`**: a new built-in skin in the Monokai palette (green user lines, cyan reads, orange writes, yellow runs, purple searches, pink web and errors). It restyles the transcript's tool rows, diffs, tables and code cards; it does not change the app's window chrome.

- **Monokai green theme.** Dark: Monokai's green, yellow, pink and cyan on `#272822`. Light: deeper versions of the same hues. The band and panel both use it (it was clay orange).
- **Mods section in the Cockpit panel.** Press a button to open the agents panel, file tree or replay, set a skin, turn reflect on or off, or arm and stop keep-warm.
- **New SVG header** in the panel (a prompt mark and the name), drawn from the palette. On the desktop only. It now carries the `xmlns` namespace, which the first SVG band was missing.

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
