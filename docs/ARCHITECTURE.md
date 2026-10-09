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

## How the band is built

The band is the part that took the most iterations, and each rule below exists because the alternative visibly went wrong.

**On desktop it is one SVG card.** The desktop surface has no element for a ring or a meter, so the card is an `<svg>` drawn by `card()` in `cockpit/hooks/band.tsx`, next to a slot of native buttons. The terminal gets a plain two-line text version of the same data.

**The card paints its own background.** The desktop draws an SVG inside a frame. A see-through card shows the frame's white backdrop. The card fills with the band's own colour (`#212121` dark, `#faf9f5` light) and declares `color-scheme: dark light`, so there is no white edge.

**The SVG text must stay identical between real changes.** The desktop discards and repaints the frame whenever the SVG source changes, which shows as a black flash. A countdown that rewrites the SVG every minute would flash every minute. So the countdown runs *inside* the SVG: the ring drains with a CSS animation sized to the time left, the amber and red turns are animations with delays, and each minute label (`42m`, `41m`, ...) is a pre-built element switched on and off at its own time. `cardOnce()` caches the SVG and its alt text and only rebuilds when something the card shows actually changes (a turn starts or ends, the task changes, a limit moves, 9router flips).

**Motion marks changes, not time.** `motionFor()` compares each drawing with the last and plays an entrance only for what changed: new task rises in while the old one lifts away, the ring refills with a flash after a turn re-caches the prompt, the 9router dot pops and ripples when it flips, the context bar glows once when you cross 70%. A redraw that changes nothing plays nothing. With Reduce Motion on, movement becomes fades and the spinner and pulses stop.

**Nothing beside the card may resize.** An earlier layout showed extra buttons on hover and hid the buttons during a turn; both changed the card's width, which rebuilt it. Now the card has a fixed width and the buttons live in a fixed-width slot. The project shortcuts swap in behind a More button instead of appearing on hover.

**A press's own work is dropped when the press ends.** Compact starts from a `clock.after` timer that returns the `/compact` run, so releasing the click does not cancel it. This pattern comes from claude-skins.

**State.** Values the drawing reads (`lastAt`, `next`, `router`, `quick`, `quickOpen`, `tick`) live in `$.state`, declared in `cockpit/types/index.d.ts`. The desktop drawing does not subscribe to `tick`, so the 30-second background check never redraws it.

## The guards

`cockpit/hooks/guards.ts` is two hooks:

- `tool.call` on `Bash` refuses a command that matches the co-author pattern and tells Claude how to fix it.
- `prompt.submit` holds a prompt with a key-shaped string once (it remembers the held text so the second Enter goes through, and puts the text back in the box with `prompt.fill`), and otherwise adds a hidden context line for design prompts.

## What the vendored patches change

Each mod's `SOURCE.md` lists its exact changes. In short: three mods now stack their band instead of replacing it; cache-tax gains the `guard` and `autoWarm` settings with quiet defaults; claude-reflect starts paused; skins starts with the skin and its band off; filetree is unchanged.
