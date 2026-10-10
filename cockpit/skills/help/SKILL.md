---
name: help
description: Cheat sheet for the cockpit plugin and the mods it installs (band, next task, keep-warm, skins, file tree, replay, blast-radius, reflect, agents panel). Use when the user asks what a cockpit command or band button does, how to turn a mod on or off, or what is installed.
---

# Cockpit

`cockpit` is one plugin that installs the band above the prompt and seven mods beside it. Everything below is already installed; this is only what to type.

## The band and the panel (cockpit itself)

One line above the prompt: the cache countdown (`◔ 42m`), context, and the next task, with Continue and Details at the right. The 5-hour and weekly limits join the line once they pass 60%; `9router down` shows only if it was up and stopped. Press the buttons with a click, or focus the band (ctrl+x tab) and use the key.

| Button | Key | Does |
|---|---|---|
| Continue | `c` | Sends "continue with the next task" for the first open line of the project's `.claude/NEXT.md`. |
| Details | `d` | Opens the Cockpit panel (also `/cockpit`). |
| Compact | `k` | Appears past 70% context. Runs `/compact` and tells it to keep the plan, open tasks, PRs, decisions and open bugs. |

The **Cockpit panel** is a tab in the side panel with room for everything: prompt cache (time left and a bar), context (tokens, percent, window, Compact), plan limits with when they reset, session cost, your next five tasks (Continue `c`, What's next? `n`, which asks Claude to write the next three into `NEXT.md` without starting them), and this project's shortcut buttons (`1` to `3`). Shortcuts come from `.claude/quick.json`, a list of `{ "label", "prompt" }`; without one, IntPortal and Obsidian-vault projects get presets.

Commands: `/next` shows the task, `/next <text>` adds one on top, `/next done` checks the first one off.

Guards that run quietly: a Bash command carrying a Claude or Anthropic co-author line is refused; a prompt with a pasted API key is held once (Enter again sends it); UI prompts get a hidden nudge toward the impeccable skill.

## The seven mods

| Mod | Command | Default here |
|---|---|---|
| cache-tax | `/keepwarm [90m \| always \| status \| off]`, `/cache-tax [status \| guard warn \| guard refuse]` | Shows the rewrite price before a cold send and still sends. Keep-warm is **off**; it spends tokens (a model request about every 50 minutes). Settings `guard` and `autoWarm` change this. |
| claude-reflect (`reflect-mod`) | `/reflect-queue`, `/reflect-pause` | **Paused.** `/reflect-pause` turns on the check, which sends short prompts to Haiku and offers to save a rule to CLAUDE.md on a button press. `remember: <rule>` works either way. |
| skins | `/skin [name \| list \| off \| gallery \| band \| pin \| unpin]` | **Off**, and its own band is off. `/skin noir` turns the transcript redraw on. The `skin-designer` skill can make a new one with you. |
| filetree | `/filetree [path]` | Opens in the right sidebar on request; does not dock by itself (setting `autoOpen`). Needs the fullscreen layout and a wide window. |
| replay-theater | `/replay` | After a turn with edits, a hint above the prompt steps through the diffs. |
| blast-radius | none | Holds `rm -r`, `git reset --hard`, `git clean`, force push and migrations behind Proceed / Cancel. |
| savvy-progress | `/agents-info` | Shows a progress bar and an agents panel once a flow reports progress or a `savvy-*` worker starts. |

## Where things live

- Marketplace: `janvin-mods` (`cockpit` plus the seven). Each vendored plugin folder has a `SOURCE.md` with its upstream, pinned commit, licence and the exact changes.
- Per project: `.claude/NEXT.md` (task list), `.claude/quick.json` (shortcut buttons).
- Turn a mod off: `/plugin`, pick it, disable. Nothing else depends on it.
