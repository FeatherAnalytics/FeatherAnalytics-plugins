# FeatherAnalytics Plugins

A marketplace of plugins for [Claude Code](https://docs.anthropic.com/en/docs/claude-code).

## Available Plugins

| Plugin | Description |
|--------|-------------|
| [session-continuity](plugins/session-continuity/) | Inter- and intra-session continuity: handoffs, checkpoints, and session summaries. Eliminates the amnesia tax. |

## Installation

Install any plugin using the Claude Code CLI:

```bash
claude /install-plugin <plugin-path>
```

See each plugin's README for setup instructions and hook registration.

## Contributing

To add a plugin, create a directory under `plugins/` with:
- `.claude-plugin/plugin.json` — plugin metadata
- `commands/` — slash command definitions
- `rules/` — rules that load automatically
- `hooks/` — event hooks (shell wrappers)
- `src/` — source code for hooks
- `README.md` — usage documentation
