#!/bin/bash
set -e
PLUGIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cat | npx tsx "$PLUGIN_DIR/src/subagent-stop.ts"
