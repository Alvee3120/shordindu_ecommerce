# Shordindu E-commerce

Full-stack e-commerce platform (Dress, Sharee, Pant, Orna, Bag, Blouse, Panjabi, and more).

- `backend/` — Django + Django REST Framework API (owned by Alvee, branch `alvee-backend`)
- `frontend/` — Next.js frontend (owned by Nusrat, branch `nusrat-frontend`)

**Frontend engineers start here: [`API_GUIDE.md`](API_GUIDE.md)** — every endpoint, request/response
shapes, the cookie-based auth flow, and the guest-cart mechanics.

## Backend setup

Requirements: Python 3.12+, PostgreSQL, Redis.

```bash
cd backend

# 1. Create and activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# edit .env with your local DATABASE_URL, SECRET_KEY, etc.

# 4. Create the Postgres role + database referenced in .env
sudo -u postgres psql -c "CREATE USER shordindu WITH PASSWORD 'shordindu_dev_pw';"
sudo -u postgres psql -c "CREATE DATABASE shordindu_ecommerce OWNER shordindu;"

# 5. Run migrations
python manage.py migrate

# 6. Create an admin user
python manage.py createsuperuser

# 7. Run the dev server
python manage.py runserver
```

Using a hosted Postgres (Neon, Supabase, RDS) instead? Put its URL in
`DATABASE_URL` and skip step 4. Two rules for Neon:

- Use the **pooled** host (`...-pooler...`) in `DATABASE_URL` for the app, but
  the **direct** host for `migrate`, `pg_restore` and `pg_dump` — pgbouncer
  breaks session-level operations.
- `manage.py test` creates a real `test_<dbname>` database on whatever server
  `DATABASE_URL` names, so point it at a disposable database.

- Admin: http://localhost:8000/admin/
- API docs (Swagger UI): http://localhost:8000/api/docs/

### Background tasks (Celery + Redis)

Redis must be running locally (`redis-server`). In a separate terminal:

```bash
cd backend
source .venv/bin/activate
celery -A config worker -l info
```

### Media storage

Local `MEDIA_ROOT` is used by default in dev (`USE_S3=False` in `.env`).

To store uploads in **Cloudflare R2** (or AWS S3 / MinIO — the same `AWS_*` keys
work for all of them), fill this block in `backend/.env` and set `USE_S3=True`:

```bash
USE_S3=True
AWS_ACCESS_KEY_ID=<R2 token access key id>
AWS_SECRET_ACCESS_KEY=<R2 token secret access key>
AWS_STORAGE_BUCKET_NAME=<bucket name>
AWS_S3_REGION_NAME=auto
AWS_S3_ENDPOINT_URL=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
AWS_S3_CUSTOM_DOMAIN=<public bucket host, no scheme>
AWS_QUERYSTRING_AUTH=False
```

Notes:

- Create the credentials in **R2 → Manage API Tokens** with *Object Read & Write*
  scoped to the bucket. The **Account ID** is in the R2 dashboard URL.
- `AWS_S3_CUSTOM_DOMAIN` is the bucket's public host: either its
  `pub-<hash>.r2.dev` domain (enable *Public access* on the bucket) or a custom
  domain you attach. Without it, objects are only reachable through signed URLs
  — set `AWS_QUERYSTRING_AUTH=True` to serve those from a private bucket. The
  app refuses to start if neither is set.
- Uploads land under the `media/` key prefix (the storage `location`), matching
  the `/media/` path in the frontend's `next/image` allowlist.
- Files already in `backend/media/` keep working only if they are also in the
  bucket. Copy them once with:

  ```bash
  python manage.py upload_media_to_storage            # dry run
  python manage.py upload_media_to_storage --commit   # upload
  ```

- Set `NEXT_PUBLIC_MEDIA_HOSTNAME` in `frontend/.env` to the same public host
  (no scheme) so `next/image` accepts the R2 URLs. It is baked in at build time.
- `manage.py test` forces local storage regardless of `USE_S3`, so test runs
  never write fixture images into the bucket.

## Frontend setup

See [`frontend/README.md`](frontend/README.md) — owned and maintained by Nusrat.

## Project structure

```
backend/
  config/          # Django project (settings, urls, celery app)
  apps/
    core/          # shared utilities
    users/         # custom User model, auth
    catalog/       # categories, products, attributes, variations
    cart/          # cart, cart items
    orders/        # orders, payments, coupons
    reviews/       # reviews
frontend/          # Next.js app (placeholder — see frontend/README.md)
```
