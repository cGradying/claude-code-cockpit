# claude-code-cockpit

A one-line band above the Claude Code prompt, plus seven community mods, installed as one plugin. The band shows your prompt-cache countdown, context, usage limits, session cost and the next task. The mods add a file tree, edit replay, a safety hold for risky shell commands, transcript skins and more. Everything that spends tokens or redraws your screen starts **off**.

<p align="center">
  <img src="docs/images/band-warm.svg" alt="The band with a warm cache, 42 minutes left" width="880"><br>
  <img src="docs/images/band-low.svg" alt="The band with 6 minutes of cache left, context at 74 percent, limits high and 9router down" width="880"><br>
  <img src="docs/images/band-working.svg" alt="The band while a turn is running" width="880"><br>
  <img src="docs/images/band-expired.svg" alt="The band with an expired cache and nothing queued" width="880">
</p>

These images are drawn by the band's own code, not mocked up. They animate: the ring drains over the cache's lifetime, and each part fades in when it first appears.

## What is inside

| Plugin | What it does | Default here | Origin |
|---|---|---|---|
| **cockpit** | The band, next-task list, Continue / What's next / Compact buttons, guards, and a cheat-sheet skill | on | this repo (MIT) |
| cache-tax | Shows the rewrite price before a cold send; opt-in keep-warm for the prompt cache | warns, never drops; keep-warm **off** | [karanb192/cache-tax](https://github.com/karanb192/cache-tax) |
| claude-reflect (`reflect-mod`) | Notices corrections and offers to save them as rules in `CLAUDE.md` | **paused** | [BayramAnnakov/claude-reflect](https://github.com/BayramAnnakov/claude-reflect) |
| skins | Redraws the transcript: tool rows, diff cards, table and code cards, spinner | **off**, its own band off | [hellosverre/claude-skins](https://github.com/hellosverre/claude-skins) |
| filetree | IDE-style file tree in the sidebar with git status and read/write activity | on, docks when wide enough | [data-goblin/claude-code-filetree](https://github.com/data-goblin/claude-code-filetree) |
| replay-theater | Step through the last turn's file edits, one diff at a time | on | [anthropics/claude-code-playground](https://github.com/anthropics/claude-code-playground) |
| blast-radius | Holds `rm -r`, `git reset --hard`, `git clean`, force push and migrations until you press Proceed | on | [anthropics/claude-code-playground](https://github.com/anthropics/claude-code-playground) |
| savvy-progress | Progress bar and agents panel for flows and subagents | idle until something reports | [JohnnyVizz/claude-kit](https://github.com/JohnnyVizz/claude-kit) |

The seven community mods are vendored here at pinned commits, with small patches (listed in each folder's `SOURCE.md`) so they start quiet and stack above each other instead of replacing each other's band. Their original licences are kept.

## Install

Needs Claude Code 2.1.287 or later.

```text
/plugin marketplace add cGradying/claude-code-cockpit
/plugin install cockpit@janvin-mods
```

or from a terminal:

```bash
claude plugin marketplace add cGradying/claude-code-cockpit
claude plugin install cockpit@janvin-mods --scope user
```

`cockpit` lists the seven mods as dependencies, so installing it installs them all. If a dependency does not install by itself, install it by name, for example `claude plugin install skins@janvin-mods`. Then restart Claude Code (or the desktop app) and open a new session.

To remove everything: `/plugin`, pick `cockpit`, uninstall, and do the same for each mod you no longer want. Each one is independent.

## A quick tour

**The band.** One line above the prompt. Buttons sit to its right; click them, or focus the band (`ctrl+x` then `tab`) and press the key.

| Button | Key | Does |
|---|---|---|
| Continue | `c` | Sends "continue with the next task" for the first open line of `.claude/NEXT.md`, and asks Claude to check it off when done. |
| What's next? | `n` | Asks Claude to read the plan, recent commits and open PRs, then write the next three tasks into `NEXT.md` without starting them. |
| More / Back | `m` | Swaps in this project's shortcut buttons (`1` to `3`). |
| Compact | `k` | Appears past 70% context. Runs `/compact` and tells it to keep the plan, open tasks, PRs, decisions and open bugs. |

**Guards that run quietly.** A shell command carrying a Claude or Anthropic co-author line is refused. A prompt containing a pasted API key is held once (press Enter again to send it anyway). Prompts about UI or design get a hidden nudge toward the `impeccable` skill if you have it.

**Commands.** `/next`, `/keepwarm`, `/cache-tax`, `/reflect-pause`, `/reflect-queue`, `/skin`, `/filetree`, `/replay`, `/agents-info`. Details in [docs/COMMANDS.md](docs/COMMANDS.md); inside Claude Code, the `cockpit:help` skill prints the same cheat sheet.

## Quiet by default

Three things in the bundle can cost tokens or change your screen, so they start off:

- **Keep-warm** (cache-tax) sends a real model request about every 50 minutes while armed. It is off; you arm it with `/keepwarm`. The cold-send guard only *warns* by default: it shows the rewrite price and still sends your message.
- **Correction checking** (claude-reflect) sends short prompts to Haiku. It starts paused; `/reflect-pause` turns it on. `remember: <rule>` works either way and needs no model.
- **Skins** redraw the whole transcript. It starts off; `/skin noir` turns it on.

How to change each: [docs/CONFIGURATION.md](docs/CONFIGURATION.md).

## Documentation

- [docs/COMMANDS.md](docs/COMMANDS.md): every command, button, key and guard.
- [docs/CONFIGURATION.md](docs/CONFIGURATION.md): settings, `NEXT.md`, `quick.json`.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): why it is eight plugins, how the band is built, and the rules that shaped it.
- [docs/SECURITY-AUDIT.md](docs/SECURITY-AUDIT.md): what each mod runs, reads and writes, as read before shipping.
- [docs/DEVELOPING.md](docs/DEVELOPING.md): validating, testing, and updating the vendored mods.
- [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md): upstream sources, commits and licences.
- [CHANGELOG.md](CHANGELOG.md), [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md).

## Status and limits

- Written for Claude Code's mods feature, which is early access and may change between releases.
- The band was built and tested with Claude Code's plugin test kit on terminal and desktop surfaces, and its images come from its own drawing code. At the time of the first release the author had not yet watched it in the desktop app's Code tab after a clean install, so treat desktop behaviour as untested until you try it. Please open an issue with a screenshot if something looks wrong.
- The file tree needs the fullscreen layout and a wide window, and upstream says it does not load in WSL sessions of the desktop app.
- Cache timings assume the one-hour prompt cache. With a five-minute cache the countdown will be wrong.

## Credits and licences

The code in `cockpit/` is MIT, Copyright (c) 2026 cGradying (see [LICENSE](LICENSE)). Each vendored mod keeps its own licence file and authorship: the two Anthropic mods are Apache-2.0, the rest are MIT. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Thanks to the authors of all seven.
