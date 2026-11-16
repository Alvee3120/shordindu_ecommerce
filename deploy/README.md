# Deployment

Push to `main` → GitHub Actions builds → the box serves the new release.
Target host: **http://13.236.66.156**.

```
GitHub Actions                       13.236.66.156
┌────────────────────┐   scp+ssh    ┌──────────────────────────────────────┐
│ npm ci / next build│ ───────────► │ /usr/local/bin/shordindu-deploy.sh   │
│ pip install / check│  release.tgz │   extract → migrate → collectstatic  │
│ tar → artifact     │              │   flip `current` → restart services  │
└────────────────────┘              └──────────────────────────────────────┘

nginx :80
  /               → 127.0.0.1:3000   node server.js   (shordindu-web)
  /api/ /admin/   → 127.0.0.1:8000   gunicorn         (shordindu-api)
  /static/        → current/backend/staticfiles/
  /media/         → shared/media/
                    celery worker    (shordindu-worker)
```

## Layout on the server

```
/var/www/shordindu/
  releases/<sha>/{backend,frontend}   # one directory per deploy
  current -> releases/<sha>           # atomic symlink flip
  shared/
    backend.env                       # production secrets (chmod 600)
    media/                            # user uploads — survives every deploy
    venv/<req-hash>/                  # one venv per requirements.txt revision
    venv/current -> venv/<req-hash>
    backups/pre-<sha>.dump            # pg_dump taken before each migrate
    previous_release                  # what rollback.sh restores
```

## Files here

| File | Where it ends up | Who runs it |
|---|---|---|
| `bootstrap-server.sh` | run once, over SSH | you, manually |
| `deploy.sh` | `/usr/local/bin/shordindu-deploy.sh` | the workflow, via `sudo` |
| `rollback.sh` | `/usr/local/bin/shordindu-rollback.sh` | the workflow or you |
| `nginx/shordindu.conf` | `/etc/nginx/conf.d/shordindu.conf` | nginx |
| `systemd/*.service` | `/etc/systemd/system/` | systemd |
| `env.production.example` | copied to `shared/backend.env` | — |

## First-time setup

1. **Provision the host** (once, as root):

   ```bash
   scp -r deploy root@13.236.66.156:/root/shordindu-deploy
   ssh root@13.236.66.156 'bash /root/shordindu-deploy/bootstrap-server.sh'
   ```

2. **Fill in `/var/www/shordindu/shared/backend.env`** — `SECRET_KEY`,
   `DATABASE_URL`, `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, and keep
   `AUTH_COOKIE_SECURE=False` until the site is on HTTPS. Values must have no
   spaces or quotes (the deploy script sources this file).

3. **Deploy key** (the runner holds this, nothing else):

   ```bash
   ssh-keygen -t ed25519 -C gh-deploy -f gh_deploy
   ssh root@13.236.66.156 "echo '$(cat gh_deploy.pub)' >> /home/deploy/.ssh/authorized_keys"
   ```

4. **GitHub → Settings → Secrets and variables → Actions**:

   | Secret | Value |
   |---|---|
   | `SSH_HOST` | `13.236.66.156` |
   | `SSH_USER` | `deploy` |
   | `SSH_PORT` | `22` |
   | `SSH_KEY` | contents of `gh_deploy` (the private key) |

5. **Stop whatever used to serve port 80** and run *Actions → Deploy → Run workflow*.

6. Protect `main` (PR + review required) so merges are the only way to deploy.

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
ssh deploy@13.236.66.156 'sudo /usr/local/bin/shordindu-rollback.sh'
```

**Code rolls back; the database does not.** Migrations run before activation, so
keep migrations backward-compatible for one release and use
`shared/backups/pre-<sha>.dump` if you need the data back:

```bash
pg_restore --clean --no-owner -d "$DATABASE_URL" /var/www/shordindu/shared/backups/pre-<sha>.dump
```

## Logs

```bash
journalctl -u shordindu-api -f      # gunicorn
journalctl -u shordindu-worker -f   # celery
journalctl -u shordindu-web -f      # next
tail -f /var/log/nginx/error.log
```

## Gotchas

* `NEXT_PUBLIC_API_BASE_URL` is baked into the JS bundle at build time — change
  it in `.github/workflows/deploy.yml` and redeploy; restarting isn't enough.
* `backend/media/` is a symlink to `shared/media/` inside every release, so
  uploads never live in a directory that gets replaced.
* New/changed images on the API host must be whitelisted in
  `frontend/next.config.mjs` → `images.remotePatterns`, or `next/image` 400s.
* Media can live in Cloudflare R2 instead of `shared/media/`: set `USE_S3=True`
  and the `AWS_*` keys in `shared/backend.env`, then
  `python manage.py upload_media_to_storage --commit` to copy existing uploads.
  Set the `NEXT_PUBLIC_MEDIA_HOSTNAME` repository variable to the public bucket
  host so the frontend build whitelists it.
* If `DATABASE_URL` points at a pooled endpoint (Neon's `-pooler` host, pgbouncer,
  etc.), the pre-deploy `pg_dump` backup in `deploy.sh` will fail or produce an
  incomplete archive. Use the direct (non-pooled) host in `backend.env`, or
  point the backup at a `DATABASE_URL_DIRECT` variable.
* Our nginx site uses `listen 80 default_server`; the bootstrap script disables
  the distro's default site to avoid the conflict.
