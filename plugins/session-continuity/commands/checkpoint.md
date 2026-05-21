---
description: "Create or update a session checkpoint for state preservation across context clears. Use when user says 'checkpoint', 'save state', 'make a checkpoint', 'save this checkpoint', or 'checkpoint this session'."
---

# Session Checkpoint

Maintain a checkpoint file that survives `/clear` for long-running sessions. Unlike handoffs (cross-session), checkpoints preserve state within a session.

**Why clear instead of compact?** Each compaction is lossy compression -- after several rounds, you're working with degraded context. Clearing + loading the checkpoint gives fresh context with full signal.

## When to Use

- Before running `/clear`
- Context usage approaching 70%+
- Multi-phase implementations
- Complex refactors you pick up/put down

## When NOT to Use

- Quick tasks (< 30 min), simple bug fixes, single-file changes
- Already using handoffs for cross-session transfer

## Process

### 1. Ensure thoughts/ is git-excluded

On first write to `thoughts/`, auto-exclude it:

```bash
mkdir -p thoughts/checkpoints
grep -q '^thoughts/' .git/info/exclude 2>/dev/null || echo 'thoughts/' >> .git/info/exclude
```

### 2. Determine Checkpoint File

```bash
ls thoughts/checkpoints/CHECKPOINT-*.md 2>/dev/null
```

- **If exists**: Update the existing checkpoint
- **If not**: Create `thoughts/checkpoints/CHECKPOINT-<session-name>.md` (kebab-case)

### 3. Create/Update Checkpoint

Use this template:

```markdown
# Session: <name>
Updated: <ISO timestamp>

## Goal
<Success criteria -- what does "done" look like?>

## Constraints
<Tech requirements, patterns to follow, things to avoid>

## Key Decisions
- Decision 1: Chose X over Y because...

## State
- Done:
  - [x] Completed item 1
  - [x] Completed item 2
- Now: [->] Current focus (ONE item only)
- Next: Queued item
- Remaining:
  - [ ] Future item 1
  - [ ] Future item 2

## Open Questions
- UNCONFIRMED: <things needing verification after clear>

## Working Set
- Branch: `feature/xyz`
- Key files: `src/auth/`, `tests/auth/`
- Test cmd: `npm test -- --grep auth`
```

### 4. Update Guidelines

**When to update:**
- After completing a phase (update checkboxes immediately)
- After major decisions
- Before `/clear`
- When context usage >70%

**What to update:**
- Move completed items: change `[ ]` to `[x]`, update `[->]` marker
- Keep "Now" to ONE item -- forces focus, prevents sprawl
- Add new decisions as they're made
- Mark uncertain items with `UNCONFIRMED:` prefix

### 5. After Clear Recovery

1. Read the checkpoint file
2. Find `[->]` to locate current phase
3. Review `UNCONFIRMED` items -- ask 1-3 targeted questions to validate
4. Update checkpoint with clarifications
5. Continue work with fresh context

## Checkbox States

| Symbol | Meaning |
|--------|---------|
| `[x]` | Completed |
| `[->]` | In progress (current) |
| `[ ]` | Pending |

## Comparison with Other Tools

| Tool | Scope | Fidelity |
|------|-------|----------|
| CLAUDE.md | Project | Always fresh, stable patterns |
| TodoWrite | Turn | Survives compaction, understanding degrades |
| CHECKPOINT-*.md | Session | External file -- never compressed, full fidelity |
| Handoffs | Cross-session | External file -- detailed context for new session |

## Template Response

After creating/updating, respond:

```
Checkpoint updated: thoughts/checkpoints/CHECKPOINT-<name>.md

Current state:
- Done: <summary>
- Now: <current focus>
- Next: <upcoming>

Ready for /clear -- checkpoint will reload on resume.
```

## Example

```markdown
# Session: auth-refactor
Updated: 2025-01-15T14:30:00Z

## Goal
Replace JWT auth with session-based auth. Done when all tests pass and no JWT imports remain.

## Constraints
- Must maintain backward compat for 2 weeks (migration period)
- Use existing Redis for session storage

## Key Decisions
- Session tokens: UUID v4 (simpler than signed tokens)
- Storage: Redis with 24h TTL (matches current JWT expiry)

## State
- Done:
  - [x] Session model
  - [x] Redis integration
  - [x] Login endpoint
- Now: [->] Logout endpoint and session invalidation
- Remaining:
  - [ ] Middleware swap
  - [ ] Remove JWT
  - [ ] Update tests

## Open Questions
- UNCONFIRMED: Does rate limiter need session awareness?

## Working Set
- Branch: `feature/session-auth`
- Key files: `src/auth/session.ts`, `src/middleware/auth.ts`
- Test cmd: `npm test -- --grep session`
```

## Key Constraints

- **One "Now" item** -- forces focus, prevents sprawl
- **UNCONFIRMED prefix** -- signals what to verify after clear
- **Update frequently** -- stale checkpoints lose value quickly
- **Clear > compact** -- fresh context beats degraded context
- **Keep it concise** -- brevity matters for context budget
