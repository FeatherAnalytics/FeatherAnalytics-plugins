---
description: "Summarize the full work stream — reading all handoffs, checkpoints, and plans — into a single narrative document. Use when user says 'summarize session', 'summarize work stream', 'session summary', 'session diary', or 'capture session'."
---

# Summarize Session

Synthesize an entire work stream into a single narrative document. This reads ALL handoffs, checkpoints, and plans in the work stream to produce a complete picture — not just what happened in the current conversation window.

**Guiding Principle: Signal over noise.** Capture the 10% insight, skip the 90% dead ends.

## Process

### 1. Gather Context

Run in parallel:

```bash
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "none")
COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "none")
REPO=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || basename "$PWD")
TIMESTAMP=$(date +"%Y-%m-%dT%H:%M:%S%z")
FILE_TS=$(date +"%Y-%m-%d_%H-%M-%S")
```

```bash
ls thoughts/checkpoints/CHECKPOINT-*.md 2>/dev/null | head -1 | sed 's/.*CHECKPOINT-\(.*\)\.md/\1/'
```

```bash
git log --oneline --since="2 hours ago" --author="$(git config user.name)" 2>/dev/null | head -20
```

If a checkpoint exists, use its session name. Otherwise derive from branch name. If neither, ask the user for a brief descriptor.

### 2. Read the Full Work Stream (MANDATORY)

**GATE: Do NOT proceed to Step 4 until you have read ALL matching handoffs, plans, and the active checkpoint.** The summary must capture the full arc of the work stream across every session, not just the current conversation. Skipping this step produces a shallow summary that misses prior decisions, discoveries, and evolution of the work.

Find related handoffs using multi-strategy matching (stop at first strategy with results):

```bash
# Strategy 1: Dedicated folder matching session name
ls thoughts/shared/handoffs/{{session_name}}/*.md 2>/dev/null

# Strategy 2: Grep all handoffs for matching topic, tags, or branch
grep -rl "topic:.*{{session_name}}\|tags:.*{{session_name}}\|branch:.*{{session_name}}" thoughts/shared/handoffs/ 2>/dev/null

# Strategy 3: Filename keyword search
find thoughts/shared/handoffs/ -name "*{{session_name}}*" -o -name "*{{key_word}}*" 2>/dev/null
```

For strategies 2-3, derive `{{key_word}}` by splitting session name on `-` and using the most distinctive segment.

Read the active checkpoint:

```bash
cat thoughts/checkpoints/CHECKPOINT-{{session_name}}.md 2>/dev/null
```

Find related plans:

```bash
ls thoughts/shared/plans/*{{session_name}}*.md 2>/dev/null
ls thoughts/shared/plans/*{{key_word}}*.md 2>/dev/null
```

**Read EVERY matching file.** For each handoff (chronologically, oldest first), extract:
- Key Decisions with rationale
- Discoveries (non-obvious findings)
- What worked / what failed (from Post-Mortem sections)
- Open items carried forward across handoffs
- Task status evolution (how tasks progressed across sessions)

From the checkpoint, extract:
- Current phase and progress (Done / Now / Next)
- Constraints and key decisions
- Open questions

From plans, extract:
- Original scope and approach
- How the plan evolved vs. what actually happened

Hold all extracted history for step 4. Synthesize across sources — do NOT include raw content from individual files.

**Track your counts**: Record how many handoffs/plans/checkpoints you read and how many decisions/discoveries you extracted. These counts are reported in Step 8.

### 3. Scan for Confluence Page Usage (Conditional)

**Only if Atlassian MCP tools are available** (check by attempting a tool call; if unavailable, skip the Confluence Pages section entirely). Review the conversation for calls to:
- `getConfluencePage` -- READ
- `createConfluencePage` -- CREATED
- `updateConfluencePage` -- EDITED
- `searchConfluenceUsingCql` -- SEARCHED
- `getConfluencePageFooterComments` / `getConfluencePageInlineComments` -- READ (comments)
- `createConfluenceFooterComment` / `createConfluenceInlineComment` -- COMMENTED

For each page touched, record: page title, page ID, action, and whether content appeared outdated.

### 4. Synthesize the Summary

Combine the current conversation with the full work stream history from step 2. The summary should read as a cohesive narrative of the entire effort, not a report on one conversation. Answer internally:

1. **What was the goal?** (1-2 sentences — the work stream goal, not just today's task)
2. **How did the work evolve?** Key inflection points across sessions — scope changes, approach pivots, blockers encountered and resolved.
3. **What decisions were made, and WHY?** Across all sessions. Net-new or evolved rationale only — don't repeat what's obvious from the decision itself.
4. **What did we discover that wasn't obvious?** Across all sessions. Technical insights, API limitations, patterns that emerged.
5. **What got done?** (PRs, features, status changes, artifacts — the full timeline)
6. **What's still open?** (TODOs, follow-ups, unresolved questions)
7. **What patterns/conventions were established?** (reusable approaches)
8. **What Confluence pages were involved?** (from step 3, if applicable)

Apply the signal filter: skip anything obvious from code, git log, or filenames. Capture the *why* and the *non-obvious*.

### 5. Generate Tags

Auto-generate from:
- Repository name
- Branch name split on `/` and `-`
- Session name from checkpoint
- Any Confluence spaces accessed (if applicable)
- Topic-based tags from the work (e.g., `debugging`, `planning`, `migration`)

Keep tags lowercase, hyphenated, no special characters. Aim for 4-8 tags.

### 6. Write the File

Ensure output directory exists and is git-excluded:

```bash
mkdir -p thoughts/shared/sessions
grep -q '^thoughts/' .git/info/exclude 2>/dev/null || echo 'thoughts/' >> .git/info/exclude
```

**File path**: `thoughts/shared/sessions/{{FILE_TS}}_{{description}}.md`

**Template**:

```markdown
---
date: {{TIMESTAMP}}
session_name: {{session_name}}
git_commit: {{COMMIT}}
branch: {{BRANCH}}
repository: {{REPO}}
tags: [{{auto-generated tags}}]
status: complete
type: session_summary
sessions_covered: {{number of handoffs + 1 for current session}}
confluence_pages_touched: {{count}}
---

# Work Stream Summary: {{brief title}}

## Goal
{{1-2 sentences: what was this work stream trying to accomplish?}}

## Timeline & Evolution
{{How the work progressed across sessions. Key inflection points, scope changes, approach pivots. Include dates from handoff frontmatter.}}

- **Session 1 (YYYY-MM-DD)**: {{what happened}}
- **Session 2 (YYYY-MM-DD)**: {{what happened}}
- ...

## Decisions & Rationale
{{Significant decisions across ALL sessions. Mark which session each came from.}}

- **Decision**: {{what was chosen}}
  - **Session**: {{date or handoff reference}}
  - **Alternatives**: {{what else was considered}}
  - **Rationale**: {{why -- the non-obvious reasoning}}

## Discoveries
{{Non-obvious things learned across the work stream.}}

- {{discovery}} ({{session date}})

## Progress
{{What got done across the full work stream. Link to PRs, artifacts, status changes.}}

- {{milestone/artifact/PR}}

## Open Threads
{{Unfinished work, follow-ups, unresolved questions. Each should be actionable.}}

- [ ] {{TODO}}

## Patterns & Conventions
{{Reusable approaches established or confirmed. Skip if nothing new.}}

- {{pattern}}

## Confluence Pages
{{All Confluence pages accessed via MCP tools. Skip if no tools were used.}}

| Page | Action | Notes |
|------|--------|-------|
| [[page-title]] (ID: {{id}}) | {{read/created/edited}} | {{notes}} |

## Cross-References
{{Links to ALL related handoffs, checkpoints, and plans. Use wikilinks.}}

- {{related artifact}}
```

### 7. Cross-Reference Check

After writing, check for related artifacts:

```bash
ls thoughts/shared/handoffs/{{session_name}}/*.md 2>/dev/null
ls thoughts/shared/plans/*{{session_name}}*.md 2>/dev/null
ls thoughts/checkpoints/CHECKPOINT-{{session_name}}.md 2>/dev/null
```

Add any found to the Cross-References section as wikilinks.

### 8. Confirm

After writing, respond:

```
Work stream summary created: thoughts/shared/sessions/{{FILE_TS}}_{{description}}.md

Captured:
- {{S}} sessions covered ({{R}} handoffs + current session)
- {{N}} decisions documented across work stream
- {{M}} discoveries noted
- {{K}} open threads tracked
- {{P}} Confluence pages referenced
- {{Q}} cross-references linked
```

## Section Guidelines

### Required Sections
- **Goal** -- always
- **Timeline & Evolution** -- always (even for single-session work streams)
- **Decisions & Rationale** -- always (even if "no significant decisions")
- **Progress** -- always
- **Open Threads** -- always (even if "None -- clean completion")

### Optional Sections (include only when substantive)
- **Discoveries** -- skip if nothing non-obvious was learned
- **Patterns & Conventions** -- skip if no new patterns
- **Confluence Pages** -- skip if no Confluence MCP tools were used
- **Cross-References** -- skip if no related artifacts found

### Anti-Patterns to Avoid
- Do NOT list every file read or edited (that's in git)
- Do NOT paste code blocks (reference files with `path:line` syntax)
- Do NOT repeat the git log (just reference significant commits)
- Do NOT include obvious information ("we created a file called X.md")
- Do NOT write more than ~200 words per section
- Do NOT summarize only the current conversation — read the full work stream
