# Thoughts Directory Convention

This project uses a `thoughts/` directory for session artifacts:

- `thoughts/checkpoints/` — session checkpoints (intra-session state that survives `/clear`)
- `thoughts/shared/handoffs/` — handoff documents (inter-session context transfer)
- `thoughts/shared/sessions/` — session summaries (diary entries for historical reference)

These directories are created automatically by commands when first needed.

On first artifact creation, `thoughts/` is added to `.git/info/exclude` (local git exclude — does not modify the repo's `.gitignore` or affect other contributors).
