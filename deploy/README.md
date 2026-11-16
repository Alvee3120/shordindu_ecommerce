# Deployment

Push to `main` → GitHub Actions builds → GitHub pushes a release to the box.
Target host: **http://13.236.66.156**.

```
GitHub Actions                       13.236.66.156
┌────────────────────┐   scp+ssh    ┌──────────────────────────────────────┐
│ npm ci / next build│ ───────────► │ /usr/local/bin/shordindu-deploy.sh   │
│ pip install / check│  release.tgz │   extract → migrate → collectstatic  │
│ tar → artifact     │              │   flip `current` → restart services  │
└────────────────────┘              └──────────────────────────────────────┘

nginx :80  (/etc/nginx/sites-available/shordindu)
  /               → 127.0.0.1:3001   node server.js   (shordindu-frontend)
  /api/ /admin/   → 127.0.0.1:8001   gunicorn         (shordindu-backend)
  /static/        → current/backend/staticfiles/
  /media/         → shared/media/
                    celery worker    (shordindu-celery)
```

Ports 3001/8001 (not 3000/8000) so a second site can take 3002/8002 in its own
nginx server block.

## Layout on the server

```
/opt/shordindu/
  releases/<sha>/{backend,frontend}   # one directory per deploy
  current -> releases/<sha>           # atomic symlink flip
  shared/
    backend.env                       # production secrets (chmod 600, ubuntu)
    media/                            # uploads — survives every deploy
    venv/<req-hash>/                  # one venv per requirements.txt revision
    venv/current -> venv/<req-hash>
    backups/pre-<sha>.dump            # pg_dump taken before each migrate
    previous_release                  # what rollback.sh restores
```

## Files here

| File | Where it ends up | Who runs it |
|---|---|---|
| `adopt-server.sh` | run once, over SSH, **as root** | you, manually |
| `deploy.sh` | `/usr/local/bin/shordindu-deploy.sh` | the workflow, via `sudo` |
| `rollback.sh` | `/usr/local/bin/shordindu-rollback.sh` | the workflow or you |
| `nginx/shordindu.conf` | `/etc/nginx/sites-available/shordindu` | nginx |
| `systemd/*.service` | `/etc/systemd/system/` | systemd |
| `env.production.example` | reference for `shared/backend.env` | — |

There is no `bootstrap-server.sh`: the box was already provisioned by hand with
the app in `/opt/shordindu`. `adopt-server.sh` is the migration path into the
release layout, and it preserves the existing env and uploads.

## First-time adoption (once)

1. Copy the scripts over:

   ```bash
   scp -r deploy ubuntu@13.236.66.156:/tmp/shordindu-deploy
   ```

2. Run it as root. It moves the live install into `releases/` + `current/`,
   copies `backend/.env` to `shared/backend.env`, moves uploads to
   `shared/media/`, installs the units and sudoers rule, then health-checks:

   ```bash
   ssh ubuntu@13.236.66.156 'sudo bash /tmp/shordindu-deploy/adopt-server.sh'
   ```

3. Authorize the CI deploy key for `ubuntu`:

   ```bash
   ssh ubuntu@13.236.66.156
   mkdir -p /home/ubuntu/.ssh && chmod 700 /home/ubuntu/.ssh
   echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFfYEd3u3csxEnYgEYW50ltWFp3fsGW+q3HJ0r3wKPHE gh-deploy-shordindu' \
     >> /home/ubuntu/.ssh/authorized_keys
   chmod 600 /home/ubuntu/.ssh/authorized_keys
   chown -R ubuntu:ubuntu /home/ubuntu/.ssh
   ```

4. GitHub → Settings → **Environments → production** already holds the secrets:

   | Secret | Value |
   |---|---|
   | `SSH_HOST` | `13.236.66.156` |
   | `SSH_USER` | `ubuntu` |
   | `SSH_PORT` | `22` |
   | `SSH_KEY` | the private key matching the public key above |

   Repo variable `NEXT_PUBLIC_MEDIA_HOSTNAME` holds the R2 public host.

5. Run **Actions → Deploy → Run workflow**.

## Day to day

* Merge a PR into `main` → deploy runs automatically.
* Actions → Deploy → *Run workflow* re-deploys `main` on demand.
* Concurrency is `production` + `cancel-in-progress: false`, so overlapping
  pushes queue instead of racing.

## Rollback

Automatic: if the smoke test fails after activation, `deploy.sh` flips back to
the previous release and restarts. The workflow's `Roll back on failure` step
covers the case where the deploy script itself died.

Manual:

```bash
ssh ubuntu@13.236.66.156 'sudo /usr/local/bin/shordindu-rollback.sh'
```

**Code rolls back; the database does not.** Migrations run before activation, so
keep migrations backward-compatible for one release and use
`shared/backups/pre-<sha>.dump` if you need the data back:

```bash
pg_restore --clean --no-owner -d "$DATABASE_URL" /opt/shordindu/shared/backups/pre-<sha>.dump
```

## Logs

```bash
journalctl -u shordindu-backend -f   # gunicorn
journalctl -u shordindu-celery -f    # celery
journalctl -u shordindu-frontend -f  # next
tail -f /var/log/nginx/error.log
```

## Gotchas

* `NEXT_PUBLIC_API_BASE_URL` is baked into the JS bundle at build time — change
  it in `.github/workflows/deploy.yml` and redeploy; restarting isn't enough.
* `backend/media/` is a symlink to `shared/media/` inside every release, so
  uploads never live in a directory that gets replaced.
* New/changed image hosts must be whitelisted in
  `frontend/next.config.mjs` → `images.remotePatterns`, or `next/image` 400s.
* Media can live in Cloudflare R2 instead of `shared/media/`: set `USE_S3=True`
  and the `AWS_*` keys in `shared/backend.env`, then
  `python manage.py upload_media_to_storage --commit` to copy existing uploads.
* If `DATABASE_URL` points at a pooled endpoint (Neon's `-pooler` host, pgbouncer,
  etc.), the pre-deploy `pg_dump` backup in `deploy.sh` will fail or produce an
  incomplete archive. Use the direct (non-pooled) host in `backend.env`.
