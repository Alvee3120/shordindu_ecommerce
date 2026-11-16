#!/usr/bin/env bash
#
# Runs ON THE SERVER as root. Flips the `current` symlink back to the release
# that was live before the last successful deploy and restarts everything.
# Note: this restores CODE only — database migrations are not reverted.
#
#   sudo /usr/local/bin/shordindu-rollback.sh
#
set -euo pipefail

APP_DIR=/var/www/shordindu
SHARED="$APP_DIR/shared"
SERVICES="shordindu-api shordindu-worker shordindu-web"

log() { printf '\n==> %s\n' "$*"; }
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

TARGET="$(cat "$SHARED/previous_release" 2>/dev/null || true)"
[ -n "${TARGET:-}" ] && [ -d "$TARGET" ] || fail "no previous release recorded in $SHARED/previous_release"

CURRENT="$(readlink -f "$APP_DIR/current" 2>/dev/null || true)"
[ "$CURRENT" = "$TARGET" ] && fail "$TARGET is already the active release"

VENV="$(cat "$TARGET/.venv-path" 2>/dev/null || echo "$SHARED/venv/current")"
[ -x "$VENV/bin/python" ] || fail "Python environment missing: $VENV"

log "Rolling back to $TARGET"
ln -sfn "$TARGET" "$APP_DIR/current.next"
mv -T "$APP_DIR/current.next" "$APP_DIR/current"
ln -sfn "$VENV" "$SHARED/venv/current"

systemctl restart $SERVICES

for _ in $(seq 1 15); do
    if curl -fsS -m 5 http://127.0.0.1:8000/api/health/ >/dev/null 2>&1 \
        && curl -fsS -m 5 http://127.0.0.1:3000/ >/dev/null 2>&1; then
        [ -n "${CURRENT:-}" ] && echo "$CURRENT" >"$SHARED/previous_release"
        log "Rolled back to $TARGET"
        exit 0
    fi
    sleep 2
done

echo "ERROR: $TARGET is not healthy either" >&2
journalctl -u shordindu-api -u shordindu-web -n 40 --no-pager >&2 || true
exit 1
