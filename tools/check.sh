#!/bin/sh
# Pre-push check (run by the global pre-push hook, or by hand): the same build + check as the deploy workflow.
set -e
cd "$(dirname "$0")/.."
node tools/build.mjs
node tools/check.mjs
