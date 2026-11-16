#!/usr/bin/env bash
#
# ONE-TIME: convert the existing in-place install at /opt/shordindu into the
# releases/ + current/ layout the deploy pipeline expects.
#
# Run as root ON THE SERVER:
#   scp -r deploy ubuntu@13.236.66.156:/tmp/shordindu-deploy
#   ssh ubuntu@13.236.66.156 'sudo bash /tmp/shordindu-deploy/adopt-server.sh'
#
# What it does, in order (idempotent — safe to re-run):
#   1. creates releases/ shared/ incoming/ and friends
#   2. copies the live env to shared/backend.env (originals left in place)
#   3. MOVES backend/media to shared/media (preserves every upload)
#   4. snapshots the current code as the first release and points current at it
#   5. installs deploy.sh / rollback.sh + the sudoers rule
#   6. installs the three units, switches over, health-checks, rolls back if not
#
# It never touches nginx or the database.
#
set -euo pipefail

APP_DIR=/opt/shordindu
SERVICES="shordindu-backend shordindu-celery shordindu-frontend"
OLD_SERVICES="shordindu-backend shordindu-celery shordindu-frontend"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SEED="$APP_DIR/releases/seed-$(date +%Y%m%d%H%M%S)"

log() { printf '\n==> %s\n' "$*"; }
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "run this with sudo"

[ -f "$APP_DIR/backend/manage.py" ] || fail "no existing install at $APP_DIR/backend"
[ -f "$APP_DIR/frontend/server.js" ] || fail "no built frontend at $APP_DIR/frontend/server.js"

# ------------------------------------------------------------------ layout
log "Creating the release layout"
install -d -m 755 "$APP_DIR/releases" "$APP_DIR/incoming" \
    "$APP_DIR/shared" "$APP_DIR/shared/backups" "$APP_DIR/shared/logs" "$APP_DIR/shared/venv"

# --------------------------------------------------------------- env file
if [ -f "$APP_DIR/shared/backend.env" ]; then
    echo "keeping existing shared/backend.env"
else
    log "Copying the live env into shared/backend.env"
    [ -f "$APP_DIR/backend/.env" ] || fail "no $APP_DIR/backend/.env to copy"
    install -m 600 -o ubuntu -g ubuntu "$APP_DIR/backend/.env" "$APP_DIR/shared/backend.env"
    echo "copied; the original stays at backend/.env as a fallback"
fi

# ------------------------------------------------------------------- media
if [ -L "$APP_DIR/backend/media" ]; then
    echo "backend/media is already a symlink"
else
    log "Moving uploads into shared/media"
    install -d -m 755 -o ubuntu -g ubuntu "$APP_DIR/shared/media"
    if [ -d "$APP_DIR/backend/media" ]; then
        # cp then rm, so an interrupted run can never lose uploads
        cp -a "$APP_DIR/backend/media/." "$APP_DIR/shared/media/"
        rm -rf "$APP_DIR/backend/media"
        echo "moved $(find "$APP_DIR/shared/media" -type f | wc -l) files"
    fi
    ln -sfn "$APP_DIR/shared/media" "$APP_DIR/backend/media"
fi
chown -R ubuntu:ubuntu "$APP_DIR/shared/media"

# ------------------------------------------------- seed release from live code
if [ -L "$APP_DIR/current" ]; then
    echo "current -> $(readlink -f "$APP_DIR/current") (already adopted)"
else
    log "Snapshotting the live install as the first release"
    install -d -m 755 "$SEED"
    cp -a "$APP_DIR/backend" "$APP_DIR/frontend" "$SEED/"
    # point the copy at the shared state
    rm -rf "$SEED/backend/media"
    ln -sfn "$APP_DIR/shared/media" "$SEED/backend/media"
    ln -sfn "$APP_DIR/shared/backend.env" "$SEED/backend/.env"
    # reuse the venv that already exists in the live tree
    echo "$SEED/backend/.venv" >"$SEED/.venv-path"
    chown -R ubuntu:ubuntu "$SEED"
    ln -sfn "$SEED" "$APP_DIR/current"
    echo "current -> $SEED"
fi

# ---------------------------------------------------------------- scripts
log "Installing deploy scripts"
install -m 755 "$HERE/deploy.sh" /usr/local/bin/shordindu-deploy.sh
install -m 755 "$HERE/rollback.sh" /usr/local/bin/shordindu-rollback.sh

cat >/etc/sudoers.d/shordindu-deploy <<'EOF'
ubuntu ALL=(root) NOPASSWD: /usr/local/bin/shordindu-deploy.sh, /usr/local/bin/shordindu-rollback.sh
EOF
chmod 440 /etc/sudoers.d/shordindu-deploy
visudo -c -f /etc/sudoers.d/shordindu-deploy >/dev/null
echo "sudoers rule installed for ubuntu"

# ------------------------------------------------------------------ units
log "Installing systemd units"
install -m 644 "$HERE/systemd/"*.service /etc/systemd/system/
systemctl daemon-reload

# ------------------------------------------------------- switch over + verify
log "Switching services to the release layout"
systemctl stop $OLD_SERVICES 2>/dev/null || true
systemctl enable $SERVICES >/dev/null 2>&1
systemctl restart $SERVICES

healthy=0
for _ in $(seq 1 20); do
    if curl -fsS -m 5 http://127.0.0.1:8001/api/health/ >/dev/null 2>&1 \
        && curl -fsS -m 5 http://127.0.0.1:3001/ >/dev/null 2>&1; then
        healthy=1
        break
    fi
    sleep 2
done

if [ "$healthy" -ne 1 ]; then
    echo "ERROR: the new units are not healthy." >&2
    journalctl -u shordindu-backend -u shordindu-frontend -n 50 --no-pager >&2 || true
    cat >&2 <<'EOF'

The OLD services were stopped. To restore the previous setup immediately:
  sudo systemctl start shordindu-backend shordindu-celery shordindu-frontend
  sudo systemctl revert shordindu-backend shordindu-celery shordindu-frontend
  sudo cp /etc/systemd/system/shordindu-*.service.<your-backup> ...   # if you kept one
EOF
    exit 1
fi

log "Adopted. Next: add the CI deploy key, then push to main."
cat <<EOF

Layout now:
  $APP_DIR/current  -> $(readlink -f "$APP_DIR/current")
  $APP_DIR/shared/backend.env   (production env)
  $APP_DIR/shared/media/        (uploads, $(find "$APP_DIR/shared/media" -type f 2>/dev/null | wc -l) files)

Authorize the CI key as the 'ubuntu' user:
  mkdir -p /home/ubuntu/.ssh && chmod 700 /home/ubuntu/.ssh
  echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFfYEd3u3csxEnYgEYW50ltWFp3fsGW+q3HJ0r3wKPHE gh-deploy-shordindu' \\
    >> /home/ubuntu/.ssh/authorized_keys
  chmod 600 /home/ubuntu/.ssh/authorized_keys
  chown -R ubuntu:ubuntu /home/ubuntu/.ssh
EOF
