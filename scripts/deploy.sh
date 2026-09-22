#!/usr/bin/env bash
#
# Build the static SPA and mirror dist/ to the production web root.
#
# The target host is the `flexiserver` alias from ~/.ssh/config, so the
# hostname, user, port and key all live there rather than in this script.
#
# Usage:
#   pnpm deploy              build, check, upload
#   pnpm deploy --dry-run    show what would change, transfer nothing
#   pnpm deploy --skip-checks  build and upload without lint/test

set -euo pipefail

readonly REMOTE_HOST="flexiserver"
readonly REMOTE_PATH="/home/fexi5977/jeux.acolad.net/htdocs"
readonly LOCAL_DIR="dist"

cd "$(dirname "$0")/.."

dry_run=false
skip_checks=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) dry_run=true ;;
    --skip-checks) skip_checks=true ;;
    -h|--help)
      sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

step() { printf '\n\033[1;36m==>\033[0m \033[1m%s\033[0m\n' "$1"; }
fail() { printf '\n\033[1;31mDeploy aborted:\033[0m %s\n' "$1" >&2; exit 1; }

command -v rsync >/dev/null || fail "rsync is not installed."
command -v pnpm  >/dev/null || fail "pnpm is not installed."

# A deploy of a dirty tree is hard to trace back to a commit later on.
if [ -n "$(git status --porcelain)" ]; then
  printf '\033[1;33mWarning:\033[0m the working tree has uncommitted changes.\n'
fi

if [ "$skip_checks" = false ]; then
  step "Linting"
  pnpm lint || fail "lint failed."

  step "Running tests"
  pnpm test || fail "tests failed."
fi

step "Building"
pnpm build || fail "build failed."

# Guard against uploading an empty or half-written directory over production.
[ -f "$LOCAL_DIR/index.html" ] || fail "$LOCAL_DIR/index.html is missing — the build produced nothing to deploy."

step "Verifying the remote path"
ssh "$REMOTE_HOST" "test -d '$REMOTE_PATH'" \
  || fail "$REMOTE_HOST:$REMOTE_PATH is not reachable or does not exist."

# --delete mirrors the build: stale hashed assets from previous deploys go
# away. Anything placed in htdocs by hand is removed too, so keep this
# directory owned by the build.
#
# .well-known/ is the exception: it is written by the server, not by us, and
# holds the Let's Encrypt ACME challenge. Deleting it breaks certificate
# renewal, and the games need HTTPS to reach the microphone at all.
rsync_opts=(--archive --compress --human-readable --delete --stats)
rsync_opts+=(--exclude '.well-known/')
$dry_run && rsync_opts+=(--dry-run --itemize-changes)

if $dry_run; then
  step "Dry run — nothing will be transferred"
else
  step "Uploading to $REMOTE_HOST:$REMOTE_PATH"
fi

# The trailing slash on the source copies the contents of dist/, not the
# directory itself.
rsync "${rsync_opts[@]}" "$LOCAL_DIR/" "$REMOTE_HOST:$REMOTE_PATH/" \
  || fail "rsync failed."

if $dry_run; then
  step "Dry run complete"
else
  step "Deployed to https://jeux.acolad.net/"
fi
