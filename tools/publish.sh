#!/usr/bin/env bash
# Build the pre-rendered site and publish it to the gh-pages branch, which
# GitHub Pages serves at rangmudra.com. Run after changing anything in the
# admin that should show up in the indexed HTML:
#
#   cd frontend-landing/tools && ./publish.sh
#
# gh-pages holds build output only (the source stays on main), so each
# publish replaces it with a single fresh commit.
set -euo pipefail
cd "$(dirname "$0")"
[ -d node_modules ] || npm ci --silent
node build-static.mjs

SITE="$(cd .. && pwd)/_site"
REMOTE="$(git -C .. remote get-url origin)"
touch "$SITE/.nojekyll"            # serve files as-is (no Jekyll processing)

cd "$SITE"
rm -rf .git
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C .. config user.name)" -c user.email="$(git -C .. config user.email)" \
  commit -q -m "Publish site $(date -u +%Y-%m-%dT%H:%MZ) from $(git -C .. rev-parse --short HEAD)"
git ${GIT_PUSH_OPTS:+-c "$GIT_PUSH_OPTS"} push -q -f "$REMOTE" gh-pages
rm -rf .git
echo "Published to gh-pages. GitHub Pages goes live in a minute or two."
