# Configuration

## Plugin settings

Some plugins declare settings. Claude Code shows them when you install the plugin, and you can also set them in `~/.claude/settings.json` under `pluginConfigs`:

```json
{
  "pluginConfigs": {
    "cache-tax": { "options": { "guard": "refuse", "autoWarm": "on" } },
    "filetree": { "options": { "follow": "off", "column": "size" } }
  }
}
```

| Plugin | Setting | Default | Values | Effect |
|---|---|---|---|---|
| cache-tax | `guard` | `warn` | `warn`, `refuse` | `warn` shows the rewrite price before a cold send and sends. `refuse` holds your first cold message once. A choice made with `/cache-tax guard ...` is remembered and wins over this setting. |
| cache-tax | `autoWarm` | `off` | `off`, `on` | `on` arms a 3-hour keep-warm window by itself after any paid cold write (upstream's behaviour). `off` only extends a window you opened with `/keepwarm` or set to `always`. Keep-warm sends a model request about every 50 minutes. |
| filetree | `autoOpen` | `off` | `off`, `on` | `on` docks the file tree in the sidebar at session start in a wide window (upstream's behaviour). `off` opens it only when you run `/filetree`. |
| filetree | `activity` | `reads and writes` | `reads and writes`, `writes`, `reads`, `none` | Which of Claude's file activity shimmers in the tree. |
| filetree | `glyphs` | `auto` | `auto`, `nerd`, `plain` | Icon set. `auto` uses Nerd Font icons when one is installed, except in the desktop app. |
| filetree | `follow` | `on` | `on`, `off` | Whether the tree scrolls to what Claude reads, writes or commits. |
| filetree | `column` | `date` | `date`, `size` | What the right column shows. |
| polish | `mode` | `auto` | `auto`, `always`, `off` | `auto` cleans only prompts that read like dictation. `always` cleans every prompt you type. `off` never does. A choice made with `/polish` is remembered and wins. |
| polish | `review` | `send` | `send`, `review` | `send` sends the cleaned prompt at once. `review` puts it back in the box for Enter. |
| savvy-progress | `language` | `auto` | `auto`, `en`, `ru` | Panel language. |

claude-reflect and skins start quiet through their stored preferences, not settings: run `/reflect-pause` to turn the check on, and `/skin <name>` to turn a skin on. Those choices are remembered.

## Per project

Both files live in the project's `.claude/` folder, which many people keep out of git.

### `.claude/NEXT.md`

The task list the band reads. Any markdown works; the band uses the first line that looks like `- [ ] something` and ignores the rest.

```markdown
- [ ] Write the migration for the grades table
- [ ] Review PR #37
- [x] Set up CI
```

In a git worktree the band reads the main checkout's file, so every worktree of a project shows the same list. Manage it with `/next`, or let Claude fill it with the What's next? button.

### `.claude/quick.json`

The shortcut buttons shown in the Cockpit panel. A list of up to four `{ "label", "prompt" }` objects:

```json
[
  { "label": "Test", "prompt": "Run the test suite and fix any failures." },
  { "label": "Lint", "prompt": "Run the linter and fix what it reports." }
]
```

Each button sends its `prompt` as if you had typed it. The panel shows them under Shortcuts. An empty list (`[]`) shows no shortcuts. Without a `quick.json`, the band falls back to two presets that match the author's own projects: a folder whose path contains `PUPSISPortal` or `IntPortal` gets Rebuild, Simulator and Phone, and one containing `Obsidian` gets File → notes, Export PDF and Assignment. Those prompts assume the author's skills and scripts, so write your own `quick.json` if you want shortcuts that work for you, or `[]` to switch them off.

## Things that are fixed in the code

These live in `cockpit/hooks/shared.ts`, `band.tsx` and `panel.tsx`. Change them there if you need to.

- The cache lifetime is one hour (`TTL_MS` in `shared.ts`). Sessions on a five-minute cache will show a wrong countdown.
- Compact appears at 70% context (`COMPACT_AT`).
- The 9router address is `http://127.0.0.1:20128/v1/models` (`ROUTER_URL`).
- The band moves its stats to their own line below 72 columns (`isNarrow` in `band.tsx`).
- The colours: the Monokai green palette (`DARK`, `LIGHT` in `shared.ts`). Dark uses Monokai's own hues on `#272822`; light uses deeper versions of the same hues so they read on white.
- The Mods list (`MODS` in `panel.tsx`): add a row with a name, a note and the commands its buttons run.
