#!/usr/bin/env bash
#
# Runs ON THE SERVER as root (invoked by .github/workflows/deploy.yml).
#   sudo /usr/local/bin/shordindu-deploy.sh <release-sha>
#
# Layout:
#   /var/www/shordindu/releases/<sha>/{backend,frontend}
#   /var/www/shordindu/current -> releases/<sha>      (atomic flip = rollback)
#   /var/www/shordindu/shared/{media,backend.env,venv,backups,logs}
#
set -euo pipefail

APP_DIR=/var/www/shordindu
RELEASES="$APP_DIR/releases"
SHARED="$APP_DIR/shared"
SERVICES="shordindu-api shordindu-worker shordindu-web"
KEEP_RELEASES=5

SHA="${1:?usage: shordindu-deploy.sh <release-sha>}"
INCOMING="$APP_DIR/incoming/$SHA.tar.gz"
RELEASE="$RELEASES/$SHA"

log() { printf '\n==> %s\n' "$*"; }
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[ -f "$INCOMING" ] || fail "missing artifact $INCOMING"
[ -f "$SHARED/backend.env" ] || fail "missing $SHARED/backend.env (copy deploy/env.production.example)"

install -d -m 755 "$RELEASES" "$SHARED/backups" "$SHARED/logs" "$SHARED/venv" "$APP_DIR/incoming"
install -d -m 755 -o deploy -g deploy "$SHARED/media"

# ---------------------------------------------------------------- DB backup
log "Backing up the database before migrating"
DATABASE_URL="$(sed -n 's/^DATABASE_URL=//p' "$SHARED/backend.env" | head -n1)"
if [ -n "${DATABASE_URL:-}" ] && command -v pg_dump >/dev/null 2>&1; then
    if pg_dump --format=custom --no-owner --no-privileges "$DATABASE_URL" \
            >"$SHARED/backups/pre-$SHA.dump"; then
        ls -1t "$SHARED"/backups/pre-*.dump 2>/dev/null | tail -n +8 | xargs -r rm -f
    else
        rm -f "$SHARED/backups/pre-$SHA.dump"
        echo "WARN: pg_dump failed — continuing without a backup"
    fi
else
    echo "WARN: pg_dump or DATABASE_URL unavailable — skipping backup"
fi

# ------------------------------------------------------------------ extract
log "Extracting release $SHA"
PREV="$(readlink -f "$APP_DIR/current" 2>/dev/null || true)"
rm -rf "$RELEASE"
install -d -m 755 "$RELEASE"
tar -xzf "$INCOMING" -C "$RELEASE"

# ------------------------------------------------- shared state (media, env)
log "Linking shared state"
rm -rf "$RELEASE/backend/media"            # never ship uploads inside a release
ln -sfn "$SHARED/media" "$RELEASE/backend/media"
ln -sfn "$SHARED/backend.env" "$RELEASE/backend/.env"

# ------------------------------------------------------------- python venv
log "Resolving the Python environment"
REQ_HASH="$(sha256sum "$RELEASE/backend/requirements.txt" | cut -c1-12)"
VENV="$SHARED/venv/$REQ_HASH"
if [ ! -x "$VENV/bin/python" ]; then
    echo "creating $VENV"
    python3 -m venv "$VENV"
    "$VENV/bin/pip" install --upgrade pip
    "$VENV/bin/pip" install -r "$RELEASE/backend/requirements.txt"
fi
echo "$VENV" >"$RELEASE/.venv-path"

# ---------------------------------------------------- migrate + collectstatic
log "Applying migrations and collecting static files"
set -a
# shellcheck disable=SC1091
. "$SHARED/backend.env"
set +a
cd "$RELEASE/backend"
"$VENV/bin/python" manage.py migrate --noinput
"$VENV/bin/python" manage.py collectstatic --noinput

# -------------------------------------------------------------- flip switch
log "Activating release $SHA"
ln -sfn "$RELEASE" "$APP_DIR/current.next"
mv -T "$APP_DIR/current.next" "$APP_DIR/current"
ln -sfn "$VENV" "$SHARED/venv/current"

log "Restarting services"
systemctl restart $SERVICES

# ------------------------------------------------------------------- verify
log "Smoke testing"
healthy=0
for _ in $(seq 1 15); do
    if curl -fsS -m 5 http://127.0.0.1:8000/api/health/ >/dev/null 2>&1 \
        && curl -fsS -m 5 http://127.0.0.1:3000/ >/dev/null 2>&1; then
        healthy=1
        break
    fi
    sleep 2
done

if [ "$healthy" -ne 1 ]; then
    echo "ERROR: smoke test failed after activating $SHA" >&2
    journalctl -u shordindu-api -u shordindu-web -n 40 --no-pager >&2 || true
    if [ -n "$PREV" ] && [ -d "$PREV" ]; then
        echo "Rolling back to $PREV" >&2
        ln -sfn "$PREV" "$APP_DIR/current.next"
        mv -T "$APP_DIR/current.next" "$APP_DIR/current"
        [ -f "$PREV/.venv-path" ] && ln -sfn "$(cat "$PREV/.venv-path")" "$SHARED/venv/current"
        systemctl restart $SERVICES
    fi
    exit 1
fi

# remember the release we just left so rollback.sh can swap back
if [ -n "$PREV" ] && [ "$PREV" != "$RELEASE" ]; then
    echo "$PREV" >"$SHARED/previous_release"
fi

# ------------------------------------------------------------------- prune
log "Pruning old releases (keeping $KEEP_RELEASES)"
CURRENT_REAL="$(readlink -f "$APP_DIR/current")"
KEEP_ALSO="$(cat "$SHARED/previous_release" 2>/dev/null || true)"
ls -1dt "$RELEASES"/*/ 2>/dev/null | tail -n +$((KEEP_RELEASES + 1)) | while read -r dir; do
    dir="${dir%/}"
    [ "$dir" = "$CURRENT_REAL" ] && continue
    [ "$dir" = "$KEEP_ALSO" ] && continue
    echo "removing $dir"
    rm -rf "$dir"
done

rm -f "$INCOMING"
log "Deployed $SHA"
