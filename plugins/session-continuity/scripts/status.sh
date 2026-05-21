#!/bin/bash
# StatusLine script for session-continuity plugin
# Configure in settings: "statusLine": "<plugin-path>/scripts/status.sh"
# Shows: context% | branch U:N | phase status

# Context info from Claude Code environment
TOKENS="${CLAUDE_CONTEXT_TOKENS:-}"
PCT="${CLAUDE_CONTEXT_PERCENT:-}"

# Git state
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?")
DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')

# Build git segment
GIT_SEG="${BRANCH}"
[ "$DIRTY" -gt 0 ] && GIT_SEG="${GIT_SEG} U:${DIRTY}"

# Find active checkpoint
CHECKPOINT=$(ls -t thoughts/checkpoints/CHECKPOINT-*.md 2>/dev/null | head -1)
CHECKPOINT_SEG=""

if [ -n "$CHECKPOINT" ]; then
  # Extract last completed phase
  LAST_DONE=$(grep -E '^\s*- \[x\]' "$CHECKPOINT" 2>/dev/null | tail -1 | sed 's/.*\[x\] //')
  # Extract current focus
  NOW=$(grep -E '^\s*- Now:' "$CHECKPOINT" 2>/dev/null | head -1 | sed 's/.*- Now: //')

  if [ -n "$LAST_DONE" ] && [ -n "$NOW" ]; then
    CHECKPOINT_SEG="done:${LAST_DONE:0:30} now:${NOW:0:40}"
  elif [ -n "$NOW" ]; then
    CHECKPOINT_SEG="${NOW:0:50}"
  fi
fi

# Build output
OUT=""
[ -n "$TOKENS" ] && OUT="${TOKENS}"
[ -n "$PCT" ] && OUT="${OUT} ${PCT}%"
OUT="${OUT} | ${GIT_SEG}"
[ -n "$CHECKPOINT_SEG" ] && OUT="${OUT} | ${CHECKPOINT_SEG}"

echo "$OUT"
