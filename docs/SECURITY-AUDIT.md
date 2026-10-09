# What the mods do: security audit

These mods run inside every Claude Code session, with your user's permissions and access to the engine's API. Before shipping, every vendored file was read, once by three read-only review passes (one per group of mods) and again with targeted searches for process, network, file and model calls. This is a point-in-time read of the pinned commits listed in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md). It is not a guarantee about later versions: if you update a vendored mod, read the diff.

**Across all of them:** no network requests to remote hosts, no obfuscated or dynamically evaluated code, no downloaded-and-run code, no telemetry, and no handling of credentials or tokens. The only network call in the whole bundle is cockpit's check of `http://127.0.0.1:20128` (a local 9router).

## Per mod

### cockpit (this repo)
- Reads the project's `.claude/NEXT.md` and `.claude/quick.json`; writes `NEXT.md` only through `/next`.
- One local HTTP request every 30 seconds to `127.0.0.1:20128/v1/models`.
- Sends prompts only when you press a button, as if you had typed them.
- Guards refuse a shell command or hold a prompt; they never send data anywhere.

### cache-tax
- One model call, `model.fork`, only while keep-warm is armed: a constant prompt that asks for one word, over your existing transcript. Output is not capped, so each ping costs roughly a cache read of the whole context. It stops on a cold or failed ping.
- Reads `NO_COLOR` and the theme setting. No process, no file, no network.
- Stores per-session deadlines in the plugin store.
- Upstream also armed a 3-hour keep-warm by itself after any paid cold write; that is off here (`autoWarm`).

### claude-reflect (`reflect-mod`)
- When on, one `model.complete` call to Haiku per eligible prompt: a fixed instruction, the project path, the last 1200 characters of Claude's previous reply (marked untrusted) and your message (500 characters at most, secret-shaped text filtered out). No cost cap.
- The only file write is a bullet inside a marked section of `./CLAUDE.md` or `~/.claude/CLAUDE.md`, and only when you press a Save button. Rules are one line, 200 characters or fewer.
- Reads `HOME` to find the global file, and `~/.claude/CLAUDE.md` to avoid duplicates.
- Starts paused here.

### skins
- Process use: `defaults read -g AppleInterfaceStyle` (macOS) or `gsettings get org.gnome.desktop.interface color-scheme` (GNOME), only to learn light or dark, and only when nothing else decides it.
- Redraws the transcript on screen only; what Claude reads and what is stored are unchanged.
- Registers the tool `mcp__skins__design`, which can only change appearance settings (names are validated, colours must be hex, words are length-limited). It cannot write files or run commands.

### filetree
- Runs, as argument lists with no shell interpolation: `git` (status, diff, ls-files and similar, read-only), `find`, `du`, `uname`, a fixed font-probe script, and `open` (macOS) or a fixed script (Linux) or PowerShell (Windows) to open a file you double-click or press Enter on.
- On macOS it creates and deletes small marker files in the temp folder (`filetree-<session>-<n>.mark`) to detect which files a shell command changed. The names contain no file names from your project.
- Reads, every 2 seconds, a theme file under `~/.local/state/omarchy/` if it exists (a Linux desktop convention); it is harmless and usually absent on macOS.
- Passes the selected file's *path* (not contents) to Claude as context.
- **Worth knowing:** opening a file uses the OS default handler, so double-clicking a `.command`, `.app` or `.exe` in a repository would launch it.

### replay-theater
- Observes `Edit`, `Write` and `MultiEdit` calls and always passes them on unchanged.
- Reads the path each Write targets, to diff it against what is there. No process, no network, no writes.

### blast-radius
- Holds risky Bash commands and measures their effect with fixed, read-only commands: `git status`, `git diff --shortstat`, `git clean -n` (forced to a dry run), `git log`, and `bash` scripts that only list, count and size files. Paths and directories are passed as arguments, never spliced into a shell string.
- It never runs the held command itself; pressing Proceed lets the normal Bash tool run it.
- **Worth knowing:** to list pending migrations it runs the project's own tools (`manage.py showmigrations`, `alembic history`, `bin/rails db:migrate:status`, `npx --no-install prisma migrate status`) in the folder the command names, before you approve. In a repository you do not trust, that executes project code.
- A hold that errors, times out (10 minutes) or is interrupted denies the command.

### savvy-progress
- No process, network, file or model calls. Reads Claude Code's `language` setting and locale variables to pick a language.
- Registers two tools (`progress`, `step`) that update its own display, and a 1-second timer while its panel is up.

## Reporting a problem

See [SECURITY.md](../SECURITY.md).
