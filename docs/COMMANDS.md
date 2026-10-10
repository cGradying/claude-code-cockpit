# Commands, buttons and guards

Everything you can type or press once the bundle is installed. Inside Claude Code the `cockpit:help` skill prints a short version of this page.

## The band (cockpit)

A single line above the prompt, drawn with Claude's own text and buttons:

```
◔ 42m   ctx 72.5k   Next  Write docs/specs/PLAN-2.md…                       Continue   Details
```

| Part | Meaning |
|---|---|
| `◔ 42m` | Time left on the one-hour prompt cache. The pie shows how much of the hour remains. Green above 10 minutes, amber below, red once `expired` or `cold`. While a turn runs it says `✻ working`. |
| `ctx 72.5k` | Context tokens in the live window. From 60% it adds the percent and turns amber, then red from 85%. |
| `5h`, `wk` | Plan limits. Hidden until they pass 60%; the panel always shows them. |
| `9router down` | Shown only if 9router (`http://127.0.0.1:20128/v1/models`, checked every 30 seconds) answered once and then stopped. Never shown if you do not use 9router. |
| `Next` | The first open task in the project's `.claude/NEXT.md`. Truncated with an ellipsis by the app when the window is narrow. |

In a window narrower than about 72 columns the stats move to their own line above the task and buttons.

### Buttons

Click, or focus the band with `ctrl+x` then `tab` and press the key.

| Button | Key | Does |
|---|---|---|
| Continue | `c` | Sends "Continue with the next task: ...", and asks Claude to check it off in `NEXT.md` and add follow-ups. Only shown when a task exists and no turn is running. |
| Details | `d` | Opens the Cockpit panel. |
| Compact | `k` | Shown at 70% context or more, and not while a turn runs. Runs `/compact` with instructions to keep the plan, open tasks, open PRs, decisions and unresolved bugs. It starts from a timer so releasing the click does not cancel it. |

Pressing the same button twice within 10 seconds sends once. After each finished turn the "continue" prompt also appears as the dim suggestion in the prompt box, so `Tab` then `Enter` sends it. At 70% context you also get a one-time toast.

### `/cockpit`

Opens the Cockpit panel, a tab in the side panel next to the conversation.

| Block | Shows |
|---|---|
| Prompt cache | Time left (`42m left of 1 hour`), a bar, and a note: it refreshes after every answer, or the next message re-writes the context at full price once it has lapsed. |
| Context | Tokens, percent and window size (`684.5k tokens · 68% of 1M`), a bar, and a Compact button (primary from 70%). |
| Plan limits | The 5-hour and weekly limits, each with its percent, a bar and how long until it resets. |
| This session | Cost so far, and whether 9router is running (only if it has answered once). |
| Next up | The next five open tasks from `NEXT.md`, with Continue (`c`) and What's next? (`n`). What's next? asks Claude to read the plan, recent commits and open PRs and write the next three tasks as `- [ ]` lines at the top of `NEXT.md`, without starting them. |
| Mods | One row per bundled mod with buttons that run its command: Agents & progress (`/agents-info`), File tree (`/filetree`), Replay (`/replay`), Skin (`/skin noir`, `/skin off`), Reflect (`/reflect-pause`) and Keep-warm (`/keepwarm`, `/keepwarm off`). The buttons name the action they do. Each mod keeps its own state, so the row does not show whether it is on. |
| Shortcuts | This project's shortcut buttons, `1` to `3` (up to four). |

Bars are solid boxes sized in whole percents, and the empty part follows the app's light or dark theme.

### `/git`

Opens the git panel (also the `[ Git ]` button, key `g`, on the band), laid out like VS Code's Source Control with sections you can fold. It reads the repository the session is in; it never changes anything.

| Block | Shows |
|---|---|
| Branch | A green bar with the branch and `↑ahead ↓behind` (or `not pushed`). Under it Push, Open PR and Sync with base, shown only when they apply, and, when there are changes, a commit message box: type a message and press Enter to commit everything with exactly that message. |
| Changes | Changed files with VS Code's letters: `M` modified (yellow), `A` added and `U` new (green), `D` deleted (pink), `R` renamed (cyan). A button asks Claude to write the message for you. |
| Graph | The last 12 commits, the newest filled, each with its short age and one ref (`origin/…` in cyan, tags and branches in green). |
| Pull requests | Your open PRs from `gh`. A PR whose base is another open PR's branch is indented under it, bottom of the stack first, with a checks mark. Merge appears when checks pass. |
| Worktrees | Every worktree, with the ones whose work already landed marked `merged`. |
| Tidy up | How many merged worktrees and branches can go, and one button for them. |

Every button sends a prompt to Claude (`Commit` asks it to group and commit, `Merge` asks it to check and merge, `Tidy up` lists exactly what to remove and asks it to confirm there is no unpushed work first). Nothing runs behind your back, and blast-radius still guards `git reset --hard`, force pushes and the like. If `gh` is not signed in, the pull request block says so and is hidden.

### `/next`

| Typed | Does |
|---|---|
| `/next` | Shows the first open task and the file it came from. |
| `/next <text>` | Adds `- [ ] <text>` at the top of `NEXT.md`. |
| `/next done` | Checks off the first open task (`[ ]` becomes `[x]`). |

## Guards (cockpit)

- **Co-author guard.** A Bash command that contains a co-author trailer naming Claude or Anthropic, the address `noreply@anthropic.com`, or a "Generated with Claude Code" footer is refused, with a message telling Claude to remove the line and run it again. This covers `git commit` and `gh pr create`. Human co-authors pass. If you do want Claude credited, remove this guard from `cockpit/hooks/guards.ts`.
- **Key catcher.** A prompt you type that contains something shaped like an API key (`sk-` or `sk_` keys, GitHub `ghp_`, `gho_`, `ghs_` and `github_pat_` tokens, AWS `AKIA` keys, Slack `xox` tokens, Google `AIza` keys) is held once. Your text goes back in the prompt box with a note. Press Enter again to send it unchanged. Anything sent stays in the transcript in plain text, so the hold is only a nudge.
- **Design nudge.** A prompt that mentions UI or design words (`ui`, `ux`, `design`, `layout`, `color`, `theme`, `palette`, `animation`, `pixel`, `font`, `typography`, `css`, `styling`, `landing page`, `visual`) gets a hidden note telling Claude to use the `impeccable` skill. Skipped for slash commands and for prompts that already name `impeccable` or `frontend-design`. It does nothing if you do not have that skill.

## cache-tax

| Command | Does |
|---|---|
| `/keepwarm` | Arms keep-warm for six hours. About every 50 minutes idle, a tool-less fork over your transcript refreshes the cache. It stops if a ping reads cold. **Spends tokens.** |
| `/keepwarm 90m` | A window of your own (`2h30m`, `6h`, and so on). |
| `/keepwarm always` | Arms a six-hour window at every session start, remembered across sessions. |
| `/keepwarm status` | The window, the next ping and the last receipt. |
| `/keepwarm off` | Stops, forgets the window and turns `always` off. |
| `/cache-tax` | A card: cache estimate, warming window, this session's cold-write tally. |
| `/cache-tax guard warn` | Show the rewrite price before a cold send and send it (default here). |
| `/cache-tax guard refuse` | Hold your first cold message once with the price; the resend goes through. |

The guard applies when the context is at least 50,000 tokens and the cache has gone cold, to non-slash prompts that you typed.

## claude-reflect (`reflect-mod`)

| Command | Does |
|---|---|
| `/reflect-pause` | Toggles the correction check. Starts paused here. While on, each eligible prompt (typed by you, not a slash command, 500 characters or fewer, no secret-shaped text) is sent to Haiku, and a detected correction shows in a band with buttons to save it to the project or global `CLAUDE.md`. |
| `/reflect-queue` | Lists what reflect has found and what happened to it. |
| `remember: <rule>` | Typed as a prompt. Offers to save the rule directly. Needs no model call, works while paused. |

## skins

| Command | Does |
|---|---|
| `/skin` | Opens the settings page. |
| `/skin <name>` | Turns a skin on: `noir`, `tokyo-night`, `dracula`, `catppuccin`, `gruvbox`, `nord`, `mono`, `monokai`, or one you made. |
| `/skin list`, `/skin gallery` | Lists skins; opens a pane showing every element. |
| `/skin off` | Back to Claude Code's normal transcript. |
| `/skin rail`, `tables`, `shimmer`, `band`, `clip`, `icons` | Switch one feature. Leave `band` off, because cockpit owns the band. |
| `/skin pin`, `/skin unpin` | Keep a look for this folder only. |

The `skin-designer` skill lets Claude design a skin with you through the `mcp__skins__design` tool. That tool only changes appearance settings.

## filetree

`/filetree [path]` shows the file tree in the right sidebar (the current folder, or the path you give). It needs the fullscreen layout (`/tui fullscreen`) and a window at least 110 columns wide. It does not dock by itself unless you set `autoOpen` to `on`. Files Claude reads show purple, writes orange, commits green. The selected file is passed to Claude as context (path only, never contents).

## replay-theater

After a turn that edited files, a hint appears above the prompt. Press `r` or click Replay, or type `/replay`, to step through the edits one diff at a time with Prev, Next and Close.

## blast-radius

No command. When Claude runs `rm -r`, `rm -f`, `git reset --hard`, `git checkout -- .`, `git restore .`, `git clean`, a force push or a database migration, it is held and a pane shows what would change. **Proceed** lets it run, **Cancel** refuses it and tells Claude why.

## savvy-progress

`/agents-info` toggles a panel of running, finished and planned subagents with model, progress, context, estimated cost and time. A progress bar appears above the prompt once a flow reports progress or a `savvy-*` worker starts. It adds the tools `mcp__savvy-progress__progress` and `mcp__savvy-progress__step`, meant for the savvy-flow skill (not included).
