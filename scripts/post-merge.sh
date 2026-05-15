#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push

# Sync to GitHub after every merge
# The token is embedded only in the one-time push URL — never written to .git/config
if [ -n "$GITHUB_TOKEN" ]; then
  git push --force \
    "https://x-access-token:${GITHUB_TOKEN}@github.com/gajeoo/gajeoo.github.io.git" \
    main:main
  echo "GitHub sync complete."
else
  echo "WARNING: GITHUB_TOKEN is not set — skipping GitHub sync."
fi
