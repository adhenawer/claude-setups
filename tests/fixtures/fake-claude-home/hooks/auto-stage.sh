#!/bin/bash
# Auto-stage tracked changes before each commit.
set -e
git add -u
echo "auto-staged tracked changes"
