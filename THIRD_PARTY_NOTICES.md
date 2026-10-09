# Third-party notices

Seven plugins in this repository are copies of other people's work. Each keeps its upstream `LICENSE` file and authorship. Changes are recorded in each folder's `SOURCE.md`, as the Apache-2.0 licence asks for the two Anthropic mods.

| Folder | Upstream | Path in upstream | Commit | Licence |
|---|---|---|---|---|
| `replay-theater/` | https://github.com/anthropics/claude-code-playground | `claude-code/mods/replay-theater` | `569c5283d9` | Apache-2.0 |
| `blast-radius/` | https://github.com/anthropics/claude-code-playground | `claude-code/mods/blast-radius` | `569c5283d9` | Apache-2.0 |
| `savvy-progress/` | https://github.com/JohnnyVizz/claude-kit | `plugins/savvy-progress` | `272a877f39` | MIT |
| `cache-tax/` | https://github.com/karanb192/cache-tax | `hooks/`, `.claude-plugin/` | `06cac47ec1` | MIT |
| `reflect-mod/` | https://github.com/BayramAnnakov/claude-reflect | `mod/` | `b6c4232690` | MIT |
| `filetree/` | https://github.com/data-goblin/claude-code-filetree | `hooks/`, `types/`, `.claude-plugin/` | `da1da65724` | MIT |
| `skins/` | https://github.com/hellosverre/claude-skins | `hooks/`, `skills/`, `types/`, `.claude-plugin/` | `e019c98e6d` | MIT |

Not included: terminal-browser (https://github.com/zenbu-labs/terminal-browser). Its Claude plugin only works with a separate program installed by a remote script and a terminal that can draw images, so it was left out.

If you are an upstream author and want something changed or removed, open an issue.
