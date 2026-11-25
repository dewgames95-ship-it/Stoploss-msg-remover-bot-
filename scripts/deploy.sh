#!/usr/bin/env bash
# Build dist/ and publish it to the gh-pages branch (the live site). Source stays on main.
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/build.js
SRC=$(git rev-parse --short HEAD)
WT=$(mktemp -d)
git fetch -q origin gh-pages || true
git worktree add -q -B gh-pages "$WT" origin/gh-pages
find "$WT" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -r dist/. "$WT"/
touch "$WT/.nojekyll"
git -C "$WT" add -A
git -C "$WT" commit -q -m "deploy: build of main@$SRC" || echo "nothing to deploy"
git -C "$WT" push -q origin gh-pages
git worktree remove --force "$WT"
echo "deployed main@$SRC to gh-pages"
