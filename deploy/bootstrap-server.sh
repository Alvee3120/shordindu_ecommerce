#!/usr/bin/env bash
#
# ONE-TIME provisioning for the Shordindu host. Run as root on the server:
#
#   scp -r deploy root@13.236.66.156:/root/shordindu-deploy
#   ssh root@13.236.66.156 'bash /root/shordindu-deploy/bootstrap-server.sh'
#
# Safe to re-run: it never overwrites /var/www/shordindu/shared/backend.env and
# never starts the app services (the first deploy does that).
#
set -euo pipefail

APP_DIR=/var/www/shordindu
DEPLOY_USER=deploy
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log() { printf '\n==> %s\n' "$*"; }
warn() { printf 'WARN: %s\n' "$*" >&2; }

[ "$(id -u)" -eq 0 ] || { echo "run this as root" >&2; exit 1; }

# shellcheck disable=SC1091
. /etc/os-release
case "${ID}${ID_LIKE:-}" in
    *ubuntu* | *debian*) PKG=apt ;;
    *rhel* | *fedora* | *amzn*) PKG=dnf ;;
    *) echo "unsupported distro: ${PRETTY_NAME:-$ID}" >&2; exit 1 ;;
esac

install_pkgs() {
    if [ "$PKG" = apt ]; then
        DEBIAN_FRONTEND=noninteractive apt-get install -y "$@"
    else
        dnf install -y "$@"
    fi
}

# ------------------------------------------------------------------ packages
log "Base packages ($PKG)"
if [ "$PKG" = apt ]; then
    DEBIAN_FRONTEND=noninteractive apt-get update -y
    install_pkgs ca-certificates curl git nginx python3 python3-venv python3-dev \
        build-essential libpq-dev postgresql-client
    install_pkgs redis-server || warn "install Redis yourself — Celery needs it"
else
    install_pkgs ca-certificates curl git nginx python3 python3-devel gcc libpq-devel postgresql
    install_pkgs redis || install_pkgs redis6 || warn "install Redis yourself — Celery needs it"
fi

PY_OK="$(python3 -c 'import sys; print(sys.version_info >= (3, 12))')"
[ "$PY_OK" = "True" ] || warn "python3 is $(python3 -V 2>&1); Django 5.2 needs >= 3.10 but 3.12 is recommended"

# ---------------------------------------------------------------------- node
log "Node.js 22 (runtime for the Next.js standalone build)"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$NODE_MAJOR" -lt 20 ]; then
    if [ "$PKG" = apt ]; then
        curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    else
        curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
    fi
    install_pkgs nodejs
fi
echo "node $(node -v)"

# --------------------------------------------------------------- deploy user
log "Service user '$DEPLOY_USER'"
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
    useradd --create-home --shell /bin/bash "$DEPLOY_USER"
fi
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"

log "Directory layout under $APP_DIR"
install -d -m 755 "$APP_DIR" "$APP_DIR/releases" "$APP_DIR/incoming" \
    "$APP_DIR/shared" "$APP_DIR/shared/backups" "$APP_DIR/shared/logs" "$APP_DIR/shared/venv"
install -d -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APP_DIR/shared/media"
chown -R "$DEPLOY_USER":"$DEPLOY_USER" "$APP_DIR/incoming" "$APP_DIR/shared/logs"

# ------------------------------------------------------------------- scripts
log "Installing deploy scripts to /usr/local/bin"
install -m 755 "$HERE/deploy.sh" /usr/local/bin/shordindu-deploy.sh
install -m 755 "$HERE/rollback.sh" /usr/local/bin/shordindu-rollback.sh

cat >/etc/sudoers.d/shordindu-deploy <<EOF
$DEPLOY_USER ALL=(root) NOPASSWD: /usr/local/bin/shordindu-deploy.sh, /usr/local/bin/shordindu-rollback.sh
EOF
chmod 440 /etc/sudoers.d/shordindu-deploy
visudo -c -f /etc/sudoers.d/shordindu-deploy >/dev/null

# ------------------------------------------------------------------- systemd
log "installing systemd units"
install -m 644 "$HERE/systemd/"*.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable shordindu-api shordindu-worker shordindu-web >/dev/null 2>&1

# --------------------------------------------------------------------- nginx
log "Configuring nginx"
install -m 644 "$HERE/nginx/shordindu.conf" /etc/nginx/conf.d/shordindu.conf

# A distro default site would fight our `listen 80 default_server`.
if [ -L /etc/nginx/sites-enabled/default ]; then
    mv /etc/nginx/sites-enabled/default "$APP_DIR/removed-nginx-default-site"
    echo "disabled /etc/nginx/sites-enabled/default"
fi
if grep -qE '^[[:space:]]*listen[[:space:]]+80[[:space:]]+default_server' /etc/nginx/nginx.conf 2>/dev/null; then
    cp -a /etc/nginx/nginx.conf "$APP_DIR/nginx.conf.bak-shordindu"
    sed -i -E 's|^[[:space:]]*(listen[[:space:]]+80[[:space:]]+default_server;)|\1 # disabled by shordindu bootstrap|' /etc/nginx/nginx.conf
    echo "removed the default_server flag from /etc/nginx/nginx.conf (backup in $APP_DIR)"
fi

nginx -t
systemctl enable nginx >/dev/null 2>&1
systemctl reload-or-restart nginx

# ----------------------------------------------------------------- environment
if [ ! -f "$APP_DIR/shared/backend.env" ]; then
    log "Seeding $APP_DIR/shared/backend.env from env.production.example"
    install -m 600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" \
        "$HERE/env.production.example" "$APP_DIR/shared/backend.env"
    echo "!! EDIT THIS FILE before the first deploy: $APP_DIR/shared/backend.env"
else
    echo "keeping existing $APP_DIR/shared/backend.env"
fi

# -------------------------------------------------------------------- report
log "Listeners on :80 (anything unexpected here must be stopped by hand)"
ss -tlnp 2>/dev/null | grep -E ':80[[:space:]]' || echo "nothing on :80 yet"

log "Next steps"
cat <<EOF
1. Fill in $APP_DIR/shared/backend.env (SECRET_KEY, DATABASE_URL, AUTH_COOKIE_SECURE=False).
2. Point the repo's main branch at this box:
   - SSH key:  ssh-keygen -t ed25519 -C gh-deploy -f gh_deploy
   - Append gh_deploy.pub to /home/$DEPLOY_USER/.ssh/authorized_keys
   - GitHub secrets: SSH_HOST=13.236.66.156 SSH_USER=$DEPLOY_USER SSH_PORT=22 SSH_KEY=<gh_deploy>
3. Make sure PostgreSQL and Redis are running and the database in DATABASE_URL exists.
4. Run the "Deploy" workflow (Actions -> Deploy -> Run workflow).
EOF
