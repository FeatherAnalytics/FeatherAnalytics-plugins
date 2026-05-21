---
argument-hint: "[path/to/handoff.md | folder-name]"
description: "Resume work from handoff document with context analysis and validation. Use when user says 'resume handoff', 'pick up where we left off', or 'continue from handoff'."
---

# Resume work from a handoff document

You are resuming work from a handoff document through an interactive process. Handoffs contain critical context, learnings, and next steps from previous sessions.

## Invocation Modes

Determine which mode applies based on the argument provided:

| Argument | Action |
|----------|--------|
| **Full path** to a `.md` file | Read that handoff directly, skip to Step 1 |
| **Folder name or ticket** (e.g. `ENG-2124`) | List `thoughts/shared/handoffs/<name>/`, then select the best handoff (see selection rules below) |
| **No argument** | List all subdirectories under `thoughts/shared/handoffs/`, present choices, wait for user input |

### Handoff Selection Rules (multiple files in a folder)

1. Get the current git branch: `git rev-parse --abbrev-ref HEAD`
2. Read YAML frontmatter of each handoff file looking for a `branch` field
3. **Prefer** handoffs whose `branch` matches the current git branch
4. If no branch match (or no `branch` field), fall back to **most recent** by filename timestamp (`YYYY-MM-DD_HH-MM-SS`)
5. If only one file exists, use it. If zero files or directory missing, ask the user for a path.

When no argument is provided, display:
```
I'll help you resume from a handoff. Let me find available handoffs.

Which handoff would you like to resume from?

Tip: Invoke directly with a path: /resume-handoff thoughts/shared/handoffs/ENG-XXXX/file.md
Or with a folder name: /resume-handoff ENG-XXXX
```

## Process

### Step 1: Read and Analyze Handoff

1. **Read the handoff document completely** (no limit/offset).
   Extract: task statuses, recent changes, learnings, artifacts, action items, next steps.

2. **Read linked documents directly** -- any plans or research under `thoughts/shared/plans` or `thoughts/shared/research`. Do NOT use a sub-agent for these critical files.

3. **Spawn parallel research tasks** to verify current state:

   ```
   Task: Gather artifact context
   - Read all artifacts mentioned in the handoff
   - Read implementation plans and research documents referenced
   - Extract key requirements and decisions
   Tools: Read
   Return: Summary of artifact contents and key decisions
   ```

4. **Wait for ALL research tasks** to complete before proceeding.

5. **Read remaining critical files** from "Learnings" and "Recent changes" sections.

### Step 2: Synthesize and Present

Present a comprehensive analysis to the user:

```
I've analyzed the handoff from [date] by [author].

**Tasks:**
- [Task]: [Handoff status] -> [Current verification]

**Key Learnings Validated:**
- [Learning with file:line ref] - [Still valid / Changed]

**Recent Changes:**
- [Change] - [Verified present / Missing / Modified]

**Artifacts Reviewed:**
- [Document]: [Key takeaway]

**Recommended Next Actions:**
1. [Most logical next step]
2. [Second priority]
3. [Additional discovered tasks]

**Potential Issues:**
- [Conflicts, regressions, or missing dependencies found]

Shall I proceed with [recommended action], or adjust the approach?
```

**Get confirmation** before proceeding.

### Step 3: Create Action Plan

1. **Use TodoWrite** to create a task list:
   - Convert action items from handoff into todos
   - Add new tasks discovered during analysis
   - Prioritize by dependencies and handoff guidance

2. Present the plan and confirm readiness to begin.

### Step 4: Begin Implementation

- Start with the first approved task
- Reference learnings from handoff throughout
- Apply documented patterns and approaches
- Update progress as tasks complete

## Common Scenarios

| Scenario | Signs | Approach |
|----------|-------|----------|
| **Clean continuation** | All changes present, no conflicts | Proceed with recommended actions |
| **Diverged codebase** | Changes missing/modified, new code added | Reconcile differences, adapt plan |
| **Incomplete work** | Tasks marked in_progress | Complete unfinished work first |
| **Stale handoff** | Significant time passed, major refactoring | Re-evaluate strategy from scratch |

## Guidelines

1. **Be Thorough**: Read the entire handoff. Verify ALL mentioned changes still exist. Check for regressions. Read all referenced artifacts.
2. **Be Interactive**: Present findings before starting. Get buy-in on approach. Allow course corrections.
3. **Leverage Handoff Wisdom**: Pay special attention to "Learnings". Apply documented patterns. Avoid repeating noted mistakes.
4. **Validate Before Acting**: Never assume handoff state matches current state. Verify file references exist. Check for breaking changes since handoff.
5. **Track Continuity**: Use TodoWrite for task continuity. Reference the handoff in commits. Document deviations. Consider creating a new handoff when done.

## Example Flow

```
User: /resume-handoff ENG-2124
Assistant: [Finds latest handoff in thoughts/shared/handoffs/ENG-2124/]
           [Reads handoff completely]
           [Reads linked plans/research directly]
           [Spawns research tasks for artifacts]
           [Waits for completion]

           I've analyzed the handoff from 2025-05-15...
           [Presents analysis with tasks, learnings, recommendations]

           Shall I proceed with the webhook validation fix?
User: Yes, go ahead
Assistant: [Creates TodoWrite task list, begins implementation]
```
