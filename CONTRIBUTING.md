# Contributing

Issues and pull requests are welcome, especially screenshots of how the band looks in the desktop app, and fixes for window sizes where it overflows.

- Changes to `cockpit/` need passing tests: run `claude plugin validate cockpit` and `claude plugin test cockpit` (see [docs/DEVELOPING.md](docs/DEVELOPING.md)).
- Please do not send behaviour changes for the vendored mods here. Send them upstream, then I will re-vendor. Fixes to the small patches listed in each `SOURCE.md` are fine.
- Anything that adds a process, network, file or model call needs a note in [docs/SECURITY-AUDIT.md](docs/SECURITY-AUDIT.md).
- Keep what costs tokens or changes the screen off by default.
