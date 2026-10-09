# Commands, buttons and guards

Everything you can type or press once the bundle is installed. Inside Claude Code the `cockpit:help` skill prints a short version of this page.

## The band (cockpit)

A single line above the prompt:

```
◔ 42m  ctx ▬ 72.5k  5h ▬ 10%  wk ▬ 59%  $0.21  ●  Next  Write docs/specs/PLAN-2.md…
```

| Part | Meaning |
|---|---|
| Ring and minutes | Time left on the one-hour prompt cache. Green above 10 minutes, amber below, red once expired. The ring drains on its own; it needs no redraw. While a turn runs it becomes a spinner and says `working`. |
| `ctx` | Context tokens in the live window, with a small bar for how full it is. |
| `5h`, `wk` | Percent of the 5-hour and weekly plan limits used, when your plan reports them. Bars turn amber from 60% and red from 85%. |
| `$0.21` | Session cost so far. |
| Dot | 9router health (`http://127.0.0.1:20128/v1/models`, checked every 30 seconds). Hidden until it has answered once, so it never shows if you do not use 9router. Turns into a red "9router" label when it stops answering. |
| `Next` | The first open task in the project's `.claude/NEXT.md`. |

### Buttons

Click, or focus the band with `ctrl+x` then `tab` and press the key.

| Button | Key | Does |
|---|---|---|
| Continue | `c` | Sends "Continue with the next task: ...", and asks Claude to check it off in `NEXT.md` and add follow-ups. Only shown when a task exists. |
| What's next? | `n` | Asks Claude to read the project's plan, recent commits and open PRs and write the next three tasks as `- [ ]` lines at the top of `NEXT.md`. It is told not to start them. |
| More / Back | `m` | Swaps the project shortcuts into the same slot (keys `1` to `3`, up to four). Only shown when the project has shortcuts. |
| Compact | `k` | Shown at 70% context or more. Runs `/compact` with instructions to keep the plan, open tasks, open PRs, decisions and unresolved bugs. It starts from a timer so releasing the click does not cancel it. |

The buttons hide while a turn runs. Pressing the same button twice within 10 seconds sends once.

After each finished turn the "continue" prompt also appears as the dim suggestion in the prompt box, so `Tab` then `Enter` sends it.

At 70% context you also get a one-time toast.

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
| `/skin <name>` | Turns a skin on: `noir`, `tokyo-night`, `dracula`, `catppuccin`, `gruvbox`, `nord`, `mono`, or one you made. |
| `/skin list`, `/skin gallery` | Lists skins; opens a pane showing every element. |
| `/skin off` | Back to Claude Code's normal transcript. |
| `/skin rail`, `tables`, `shimmer`, `band`, `clip`, `icons` | Switch one feature. Leave `band` off, because cockpit owns the band. |
| `/skin pin`, `/skin unpin` | Keep a look for this folder only. |

The `skin-designer` skill lets Claude design a skin with you through the `mcp__skins__design` tool. That tool only changes appearance settings.

## filetree

`/filetree [path]` shows the file tree in the right sidebar (the current folder, or the path you give). It needs the fullscreen layout (`/tui fullscreen`) and a window at least 110 columns wide. It may also dock itself at session start in a wide window. Files Claude reads show purple, writes orange, commits green. The selected file is passed to Claude as context (path only, never contents).

## replay-theater

After a turn that edited files, a hint appears above the prompt. Press `r` or click Replay, or type `/replay`, to step through the edits one diff at a time with Prev, Next and Close.

## blast-radius

No command. When Claude runs `rm -r`, `rm -f`, `git reset --hard`, `git checkout -- .`, `git restore .`, `git clean`, a force push or a database migration, it is held and a pane shows what would change. **Proceed** lets it run, **Cancel** refuses it and tells Claude why.

## savvy-progress

`/agents-info` toggles a panel of running, finished and planned subagents with model, progress, context, estimated cost and time. A progress bar appears above the prompt once a flow reports progress or a `savvy-*` worker starts. It adds the tools `mcp__savvy-progress__progress` and `mcp__savvy-progress__step`, meant for the savvy-flow skill (not included).
