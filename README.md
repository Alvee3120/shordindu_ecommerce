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

Local `MEDIA_ROOT` is used by default in dev (`USE_S3=False` in `.env`). To use S3 or an
S3-compatible store (AWS S3, MinIO, Cloudinary's S3 API) instead, set `USE_S3=True` and fill
in the `AWS_*` variables in `.env`.

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
