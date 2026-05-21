---
description: "Create handoff document for transferring work to another session. Use when user says 'create handoff', 'hand off work', 'transfer context', or 'preserve session'."
---

# Create Handoff

Create a thorough but concise handoff document to transfer work context to another session.

## Process

### 1. Gather Metadata

Determine the session name from the active checkpoint:
```bash
SESSION_NAME=$(ls thoughts/checkpoints/CHECKPOINT-*.md 2>/dev/null | head -1 | sed 's/.*CHECKPOINT-\(.*\)\.md/\1/')
SESSION_NAME=${SESSION_NAME:-general}
```

Gather git metadata:
```bash
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "none")
COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "none")
REPO=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || basename "$PWD")
```

Get current date/time:
```bash
FILE_DATE=$(date +%Y-%m-%d_%H-%M-%S)
TODAY=$(date -u +%Y-%m-%dT%H:%M:%S%z)
TODAY_SHORT=$(date +%Y-%m-%d)
```

### 2. Ensure thoughts/ is git-excluded

On first write to `thoughts/`, auto-add to `.git/info/exclude`:
```bash
grep -q '^thoughts/' .git/info/exclude 2>/dev/null || echo 'thoughts/' >> .git/info/exclude
```

### 3. Create the Handoff Document

Build the filepath: `thoughts/shared/handoffs/{SESSION_NAME}/{FILE_DATE}_description.md`

Where `description` is a brief kebab-case summary of the work.

Create the directory if needed, then write the file using this template:

```markdown
---
date: "{TODAY with timezone}"
session_name: "{SESSION_NAME}"
git_commit: "{COMMIT}"
branch: "{BRANCH}"
repository: "{REPO}"
topic: "[Feature/Task Name] Implementation Strategy"
tags: [implementation, strategy, relevant-component-names]
status: complete
last_updated: "{TODAY_SHORT}"
type: implementation_strategy
outcome: UNKNOWN
---

# Handoff: {very concise description}

## Task(s)
{Description of task(s) with status of each (completed, work in progress, planned/discussed). If working from an implementation plan, call out which phase you are on. Reference the plan and/or research documents you are working from, if applicable.}

## Critical References
{List 2-3 most important specification docs, architectural decisions, or design docs. Include file paths. Leave blank if none.}

## Recent Changes
{Describe recent codebase changes in file:line syntax.}

## Learnings
{Important discoveries -- patterns, root causes of bugs, or other information someone picking up this work should know. Include explicit file paths.}

## Post-Mortem

### What Worked
- Approach: [what and why it worked]
- Pattern: [pattern name] was effective because [reason]

### What Failed
- Tried: [approach] -> Failed because: [reason]
- Error: [error type] when [action] -> Fixed by: [solution]

### Key Decisions
- Decision: [choice made]
  - Alternatives considered: [other options]
  - Reason: [why this choice]

## Artifacts
{Exhaustive list of artifacts produced or updated as filepaths and/or file:line references.}

## Action Items & Next Steps
{List of action items for the next session based on task statuses.}

## Other Notes
{Other useful references, codebase locations, or important context that doesn't fit above.}
```

### 4. Mark Session Outcome (REQUIRED)

After writing the handoff, you MUST ask the user about the session outcome.

Use AskUserQuestion with:
- **Question:** "How did this session go?"
- **Options:**
  - SUCCEEDED: Task completed successfully
  - PARTIAL_PLUS: Mostly done, minor issues remain
  - PARTIAL_MINUS: Some progress, major issues remain
  - FAILED: Task abandoned or blocked

After the user responds, update the `outcome` field in the handoff file's YAML frontmatter from `UNKNOWN` to the user's choice. Use Edit to replace `outcome: UNKNOWN` with `outcome: {USER_CHOICE}`.

### 5. Confirm Completion

After marking the outcome, respond:

```
Handoff created! Outcome marked as [OUTCOME].

Resume in a new session with:
/resume-handoff path/to/handoff.md
```

## Guidelines

- **More information, not less.** The template is a minimum. Include more if necessary.
- **Be thorough and precise.** Include both top-level objectives and lower-level details.
- **Avoid excessive code snippets.** Prefer `path/to/file.ext:line` references over large code blocks. Only include snippets when necessary (e.g. an error being debugged).
