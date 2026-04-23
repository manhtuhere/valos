#!/usr/bin/env bash
# Push the committed val-os-vercel repo to GitHub.
# Requires: gh CLI authenticated (run `gh auth login` first).
#
# Usage:
#   ./push.sh                    # creates public repo named val-os-vercel
#   ./push.sh --private          # creates private repo
#   ./push.sh my-repo-name       # custom name, public
#   ./push.sh my-repo-name --private
set -euo pipefail

NAME="val-os-vercel"
VIS="--public"

for arg in "$@"; do
  case "$arg" in
    --public)  VIS="--public" ;;
    --private) VIS="--private" ;;
    *)         NAME="$arg" ;;
  esac
done

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI not found. Install: https://cli.github.com — or create the repo in the UI and run:"
  echo "  git remote add origin git@github.com:<you>/$NAME.git"
  echo "  git branch -M main"
  echo "  git push -u origin main"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "gh not authenticated. Run: gh auth login"
  exit 1
fi

# Ensure the branch is main (git init defaults to master on older git)
git branch -M main 2>/dev/null || true

gh repo create "$NAME" "$VIS" --source=. --push
echo "✓ pushed to github.com/$(gh api user --jq .login)/$NAME"
echo "next: https://vercel.com/new → Import Git Repository → pick $NAME"
