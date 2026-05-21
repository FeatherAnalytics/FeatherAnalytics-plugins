# session-continuity

Zero-config session continuity for Claude Code. Eliminate the amnesia tax across context clears and multi-session work.

## What It Does

This plugin gives any developer inter- and intra-session continuity via:

- **4 commands** for creating, resuming, and summarizing session state
- **2 rules** for natural language routing and directory conventions
- **3 hooks** that auto-generate handoffs, auto-load checkpoints, and track sub-agent work
- **1 StatusLine script** for at-a-glance context visibility

The hooks are the backbone — they auto-generate handoffs before context loss, auto-load checkpoints on resume, and track sub-agent work in the checkpoint. The commands are the manual interface for explicit control.

## When This Helps (and When It Doesn't)

### How it compares to built-in Claude Code features

| Feature | What it handles | Gap this plugin fills |
|---------|----------------|----------------------|
| **Standard compaction** | Lossy compression of conversation history | Compaction discards reasoning, partial results, and task focus. This plugin captures scope, progress, and remaining work while context is fresh — you control what survives. |
| **CLAUDE.md files** | Project conventions, coding standards, tool preferences | Great for _how to work_, but limited to ~50K tokens and not designed for tracking _what work is happening_. |
| **Auto-memory** | Persisted facts about preferences, patterns, and project context | Useful for stable facts, but entries can accumulate and become stale across sessions. Not designed for tracking active work streams. |

**In short:** built-in features handle _how to work_. This plugin handles _what work is happening_ — task state, progress, structured handoffs between sessions, and work stream history.

### Good fit

- Work that spans multiple sessions (multi-day features, large refactors, epics)
- Sessions that consume a lot of context (reading Confluence pages, analyzing large codebases, research-heavy tasks)
- Coordinating sub-agents on complex tasks where you need to preserve what each agent discovered
- Any work where losing context mid-stream means repeating hours of exploration

### Not a good fit

- Short, self-contained sessions where the task starts and finishes in one conversation
- Small, well-scoped tasks with clear inputs and outputs
- Simple bug fixes or config changes that don't require multi-step reasoning

### Risks and maintenance

This plugin operates in the same space as Claude Code's compaction and memory systems. As Anthropic evolves those features, interactions are possible. Things to watch for:

- **Compaction behavior changes** — If Anthropic improves compaction to preserve more context, the PreCompact hook's auto-handoff may become partially redundant. The plugin will still work, but you may find you need it less.
- **Memory system expansion** — If auto-memory gains work-tracking capabilities, some overlap with checkpoints could emerge.
- **Hook API changes** — The plugin depends on `PreCompact`, `SessionStart`, and `SubagentStop` hook events. Changes to hook timing or input format could require updates.

Stay current with the [Claude Code Changelog](https://code.claude.com/docs/en/changelog) to catch relevant changes early.

## Install

```bash
claude /install-plugin session-continuity
```

## Setup

### Hook Registration (Required)

Hooks cannot be auto-registered by plugins. Add these to your `.claude/settings.json`:

```json
{
  "hooks": {
    "PreCompact": [{
      "hooks": [{
        "type": "command",
        "command": "npx tsx <plugin-path>/src/pre-compact.ts"
      }]
    }],
    "SessionStart": [{
      "matcher": "resume|compact|clear",
      "hooks": [{
        "type": "command",
        "command": "npx tsx <plugin-path>/src/session-start.ts"
      }]
    }],
    "SubagentStop": [{
      "hooks": [{
        "type": "command",
        "command": "npx tsx <plugin-path>/src/subagent-stop.ts"
      }]
    }]
  }
}
```

Replace `<plugin-path>` with the actual plugin install path (shown after install).

### StatusLine (Optional)

Add to your settings for at-a-glance context and checkpoint state:

```json
{
  "statusLine": "npx tsx <plugin-path>/scripts/status.ts"
}
```

Shows: `150.6K 75% | main U:3 | done:Phase 2 now:Phase 3: Current task`

### Prerequisites

The hooks and scripts use `npx tsx` to run TypeScript directly — no build step needed, and works on macOS, Linux, and Windows. Ensure `tsx` is available:

```bash
npm install -g tsx
```

## Commands

### `/checkpoint`

Create or update a state file that survives `/clear`. Use for multi-phase implementations, long debugging sessions, or any session expected to hit 85%+ context.

```
/checkpoint
```

Creates `thoughts/checkpoints/CHECKPOINT-{session-name}.md` with Goal, Constraints, Key Decisions, State (with checkbox tracking), Open Questions, and Working Set sections.

### `/create-handoff`

Generate a structured handoff document at end of session, capturing task status, learnings, decisions, and next steps.

```
/create-handoff
```

Creates `thoughts/shared/handoffs/{session-name}/YYYY-MM-DD_HH-MM-SS_description.md` with YAML frontmatter including outcome tracking.

### `/resume-handoff [path | folder-name]`

Read a handoff document, validate state against current codebase, and create an action plan.

```
/resume-handoff thoughts/shared/handoffs/my-feature/2026-01-15_10-30-00_progress.md
/resume-handoff my-feature
/resume-handoff
```

Supports branch-aware handoff matching — prefers handoffs whose `branch` frontmatter matches your current git branch.

### `/summarize-session`

Synthesize the full work stream — reading all handoffs, checkpoints, and plans — into a single narrative document.

```
/summarize-session
```

Creates `thoughts/shared/sessions/{timestamp}_{description}.md`. Reads every handoff and checkpoint in the work stream to produce a complete picture across all sessions, not just the current conversation. Optionally scans for Confluence page usage if Atlassian MCP tools are available.

## Hooks

### PreCompact — Auto-Handoff Generation

**Trigger:** Before context compaction (manual or auto).

On auto-compact: parses the session transcript and generates a full handoff document with in-progress tasks, recent tool calls, files modified, errors encountered, and last context. Appends a git-based summary to the active checkpoint.

On manual compact: outputs a reminder to update the checkpoint.

### SessionStart — Auto-Load Checkpoint

**Trigger:** On resume, compact, or clear (NOT startup).

Loads the full checkpoint into context, prunes stale entries (removes "Session Ended" blocks, caps agent reports at 10), surfaces the latest handoff with branch-aware matching, and flags unmarked handoff outcomes.

Stale handoffs (>7 days) are flagged in the message.

### SubagentStop — Track Agent Work

**Trigger:** When any sub-agent completes.

Parses the agent's transcript to identify what it did, then appends a report to the active checkpoint under `## Agent Reports`.

## Directory Convention

The plugin creates artifacts in `thoughts/`:

```
thoughts/
  checkpoints/          # Session checkpoints (intra-session)
  shared/
    handoffs/           # Handoff documents (inter-session)
    sessions/           # Session summaries (diary entries)
```

On first artifact creation, `thoughts/` is automatically added to `.git/info/exclude` (local git exclude — does not modify `.gitignore` or affect other contributors).

## Outcome Tracking

Handoffs include an `outcome` field in YAML frontmatter:

```yaml
outcome: UNKNOWN  # Set on creation
```

After completing a session, the `/create-handoff` command asks you to mark the outcome. The SessionStart hook surfaces unmarked handoffs so you can update them:

```
outcome: SUCCEEDED | PARTIAL_PLUS | PARTIAL_MINUS | FAILED
```

No external database required — outcomes live in the handoff files themselves.

## Natural Language

The plugin includes a rule that maps natural language to commands:

- "create a handoff", "hand off work", "transfer context", "preserve session" → `/create-handoff`
- "resume handoff", "pick up where I left off" → `/resume-handoff`
- "make a checkpoint", "save this checkpoint", "checkpoint this session", "save state", "save progress" → `/checkpoint`
- "summarize session", "summarize work stream", "session diary" → `/summarize-session`
