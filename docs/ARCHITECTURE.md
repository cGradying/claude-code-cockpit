# Architecture

## Why eight plugins instead of one

The goal was one plugin that does everything. Claude Code's validator makes that impossible, so the bundle is one *umbrella* plugin that depends on seven others.

Three rules decided it:

1. **A plugin has one hooks module.** That module can `import` other files of the plugin, so several mods can be called from one entry file.
2. **One plugin may not hook the same event twice without a matcher.** Merging skins and filetree into one plugin fails validation with `on("session.start") is registered twice without a matcher`, because both hook `session.start`. Several other mods do too.
3. **State is keyed by plugin name.** Every mod stores its values with `plugin: '<its own name>'`, and the types contract has to match. Folding seven mods under one name would mean rewriting each one's state, which makes later upstream updates painful.

So `cockpit` (the band and guards) lists the seven mods under `dependencies` in its `plugin.json`, and each mod stays a separate plugin under its original name, as close to upstream as possible. Installing `cockpit` installs the lot; each can still be disabled alone.

```
.claude-plugin/marketplace.json   the janvin-mods marketplace
cockpit/                          band + guards + cheat-sheet skill (this repo's own code)
cache-tax/  reflect-mod/  skins/  filetree/
replay-theater/  blast-radius/  savvy-progress/    vendored, each with SOURCE.md
```

Inside `cockpit`, `hooks/register.tsx` is the one entry module. It calls `band` and `guards`, and each file owns its own events, so nothing is hooked twice.

## Sharing the band slot

Most of these mods draw something above the prompt: the replay hint, the reflect proposal, the savvy progress bar, cache-tax's warming strip, skins' usage band. In Claude Code, a `ui.render` hook that returns a tree without calling `next(e)` hides everything beneath it.

The fix is the pattern skins and reflect already use. A hook calls `const below = await next(e)` first, then returns its own row with `below` underneath:

```tsx
const below = await next(e)
return <Box flexDirection="column">{mine}{below}</Box>
```

`cockpit` does this, and the vendored replay-theater, blast-radius and savvy-progress were patched to do it. The result is a stack: the cockpit row always on top, everything else only while it has something to say. Skins' own band is switched off by default so two usage bands never compete.

## How the band and the panel are built

The first version drew the band as one SVG card, with a running countdown, entrance animations and memoised source text. In the real desktop app that card rendered blank, and it had caused every visual problem along the way: a white edge, a black flash, a width that shrank. It was deleted. The rule that replaced it: **draw with the app's own elements.**

**Native elements only.** `Box`, `Text` and `Button` take the app's fonts and theme, are crisp at any size, cannot flash, and truncate long text by themselves (`wrap="truncate-end"`), so there are no pixel-per-column guesses. The same tree serves the terminal and the desktop. The band went from 565 lines to under 250.

**The band shows only what you glance at.** Cache countdown, context, the next task, and at most three buttons. Limits appear on the line only past 60%; cost, 9router status, What's next? and the shortcuts live in the panel. Showing exceptions instead of everything is what keeps one line calm.

**The panel has the room.** `/cockpit` or Details opens a pane, which the app shows as a tab in the side panel beside the conversation. Claude Code's mod API opens panes and cannot open free-floating windows (a hover card is clipped to the band), so a pane is the closest thing to a floating information window. Each block is a dim title over its numbers, with bars made of boxes.

**Bars are boxes, not characters.** A row of block characters showed seams, wrapped onto a second line, and drew the empty and full blocks at different widths. A bar is a full-width track `Box` with a filled `Box` inside it sized in percent. The engine only accepts whole percentages, so values are rounded. The track colour comes from the app theme (`config.list`).

**Sharing the band slot.** Most mods draw something above the prompt. A `ui.render` hook that returns without calling `next(e)` hides everything beneath it, so the pattern is `const below = await next(e)` and then `<Box column>{mine}{below}</Box>`. `cockpit` does this and the vendored replay-theater, blast-radius and savvy-progress were patched to.

**A press's own work is dropped when the press ends.** Compact starts from a `clock.after` timer that returns the `/compact` run, so releasing the click does not cancel it. The pattern comes from claude-skins.

**State.** Values the drawing reads (`lastAt`, `next`, `tasks`, `router`, `quick`, `tick`) live in `$.state`, declared in `cockpit/types/index.d.ts`. A 30-second pulse updates `tick`, which redraws the countdown and checks 9router.

**Rules the validator enforces** (they shaped the file layout): a plugin has one hooks module; `$` may only be passed to functions declared in the same file, never across an import, so each of `band.tsx` and `panel.tsx` declares its own small action functions and its own atoms; shared data and pure helpers live in `shared.ts`.

**Look at the real thing.** Anything drawn is checked in the actual window, not only in tests: the engine's own messages in the transcript (for example "Box prop width must be a number or a percentage") are the fastest way to find a refused tree.

## The guards

`cockpit/hooks/guards.ts` is two hooks:

- `tool.call` on `Bash` refuses a command that matches the co-author pattern and tells Claude how to fix it.
- `prompt.submit` holds a prompt with a key-shaped string once (it remembers the held text so the second Enter goes through, and puts the text back in the box with `prompt.fill`), and otherwise adds a hidden context line for design prompts.

## What the vendored patches change

Each mod's `SOURCE.md` lists its exact changes. In short: three mods now stack their band instead of replacing it; cache-tax gains the `guard` and `autoWarm` settings with quiet defaults; claude-reflect starts paused; skins starts with the skin and its band off; filetree is unchanged.
