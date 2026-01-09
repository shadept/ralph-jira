#!/bin/bash
# Run the AI loop locally for a given run ID
# Usage: ./run-loop-local.sh <runId>

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <runId>"
    echo "Example: $0 run-abc123"
    exit 1
fi

RUN_ID="$1"
PROJECT_PATH="$(pwd)"

echo "Starting run-loop for run: $RUN_ID"
echo "Project path: $PROJECT_PATH"

node tools/runner/run-loop.mjs --runId "$RUN_ID" --projectPath "$PROJECT_PATH"
