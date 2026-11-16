"""
Django settings for the Shordindu e-commerce backend.
"""

from datetime import timedelta
from pathlib import Path

import environ
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DEBUG=(bool, False),
    USE_S3=(bool, False),
    CORS_ALLOW_ALL_ORIGINS=(bool, False),
)
environ.Env.read_env(BASE_DIR / ".env")


# --------------------------------------------------------------------------
# Core
# --------------------------------------------------------------------------

SECRET_KEY = env("SECRET_KEY")
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])


# --------------------------------------------------------------------------
# Applications
# --------------------------------------------------------------------------

DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "drf_spectacular",
    "django_filters",
]

LOCAL_APPS = [
    "apps.core",
    "apps.users",
    "apps.catalog",
    "apps.cart",
    "apps.orders",
    "apps.reviews",
    "apps.analytics",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

AUTH_USER_MODEL = "users.User"

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"


# --------------------------------------------------------------------------
# Database
# --------------------------------------------------------------------------

DATABASES = {
    "default": env.db("DATABASE_URL"),
}


# --------------------------------------------------------------------------
# Password validation
# --------------------------------------------------------------------------

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]


# --------------------------------------------------------------------------
# Internationalization
# --------------------------------------------------------------------------

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Dhaka"
USE_I18N = True
USE_TZ = True


# --------------------------------------------------------------------------
# Static & media files
# --------------------------------------------------------------------------

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# Wired for Cloudflare R2's S3 API, but the same keys work for AWS S3, MinIO or
# any S3-compatible store. Leave USE_S3=False to keep uploads on local disk.
USE_S3 = env("USE_S3")

if USE_S3:
    AWS_ACCESS_KEY_ID = env("AWS_ACCESS_KEY_ID", default="")
    AWS_SECRET_ACCESS_KEY = env("AWS_SECRET_ACCESS_KEY", default="")
    AWS_STORAGE_BUCKET_NAME = env("AWS_STORAGE_BUCKET_NAME", default="")
    # R2 has no regions but boto3 insists on one; "auto" is what Cloudflare
    # documents. AWS S3 users must set the real bucket region instead.
    AWS_S3_REGION_NAME = env("AWS_S3_REGION_NAME", default="auto")
    # R2: https://<ACCOUNT_ID>.r2.cloudflarestorage.com
    # MinIO: http://localhost:9000. Unset falls back to AWS S3.
    AWS_S3_ENDPOINT_URL = env("AWS_S3_ENDPOINT_URL", default=None) or None
    # Public host without a scheme — either the pub-<hash>.r2.dev domain or a
    # custom domain attached to the bucket. When set, .url() returns that
    # CDN-style URL instead of one signed against the endpoint.
    AWS_S3_CUSTOM_DOMAIN = (env("AWS_S3_CUSTOM_DOMAIN", default="") or "").strip()
    # django-storages prepends the protocol itself; a pasted "https://" would
    # produce "https://https://…" and every image would break.
    if "://" in AWS_S3_CUSTOM_DOMAIN:
        AWS_S3_CUSTOM_DOMAIN = AWS_S3_CUSTOM_DOMAIN.split("://", 1)[1]
    AWS_S3_CUSTOM_DOMAIN = AWS_S3_CUSTOM_DOMAIN.rstrip("/") or None
    # R2 only speaks SigV4. "path" keeps the bucket in the URL path, which is
    # what Cloudflare's boto3 examples use and what avoids TLS wildcard issues
    # for bucket names containing dots. "virtual" also works on R2.
    AWS_S3_SIGNATURE_VERSION = env("AWS_S3_SIGNATURE_VERSION", default="s3v4")
    AWS_S3_ADDRESSING_STYLE = env("AWS_S3_ADDRESSING_STYLE", default="path")
    AWS_S3_OBJECT_PARAMETERS = {"CacheControl": "max-age=86400"}
    AWS_DEFAULT_ACL = None
    # False suits a public bucket. Set True if the bucket stays private, so
    # .url() hands out time-limited signed links instead of dead 403s.
    AWS_QUERYSTRING_AUTH = env.bool("AWS_QUERYSTRING_AUTH", default=False)
    # Otherwise a second upload of "image.jpg" silently replaces the first.
    AWS_S3_FILE_OVERWRITE = env.bool("AWS_S3_FILE_OVERWRITE", default=False)

    # R2's S3 endpoint (…r2.cloudflarestorage.com) never serves objects
    # anonymously — public reads only happen through the bucket's r2.dev domain
    # or a custom domain. Without one, FILEBROWSER-style unsigned .url() values
    # would point at endpoints that 403, so fail at boot instead of shipping
    # broken image links.
    if (
        AWS_S3_ENDPOINT_URL
        and "r2.cloudflarestorage.com" in AWS_S3_ENDPOINT_URL
        and not AWS_S3_CUSTOM_DOMAIN
        and not AWS_QUERYSTRING_AUTH
    ):
        raise ImproperlyConfigured(
            "USE_S3 is on with a Cloudflare R2 endpoint but neither "
            "AWS_S3_CUSTOM_DOMAIN nor AWS_QUERYSTRING_AUTH=True is set. Set "
            "AWS_S3_CUSTOM_DOMAIN to the bucket's public host (pub-<hash>.r2.dev "
            "or your custom domain) for a public bucket, or AWS_QUERYSTRING_AUTH="
            "True to serve signed URLs from a private bucket."
        )

    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3.S3Storage",
            "OPTIONS": {"location": "media"},
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    }
else:
    STORAGES = {
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    }

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Tests always use local media storage, even when .env enables S3/R2 — otherwise
# a `manage.py test` run uploads fixture images into the real bucket.
TEST_RUNNER = "config.test_runner.LocalStorageDiscoverRunner"


# --------------------------------------------------------------------------
# CORS (Next.js frontend)
# --------------------------------------------------------------------------

# Dev tunnels terminate TLS and forward plain HTTP to the local server, so
# without this Django thinks every request is http:// and generates mixed-
# content media/absolute URLs and mishandles Secure-cookie/CSRF checks.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True

CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=["http://localhost:3000"])
# Lets the frontend's VS Code dev tunnel origin (a different random subdomain
# each session) through without needing to hardcode/update it per session.
CORS_ALLOWED_ORIGIN_REGEXES = env.list("CORS_ALLOWED_ORIGIN_REGEXES", default=[])
CORS_ALLOW_ALL_ORIGINS = env("CORS_ALLOW_ALL_ORIGINS")
# JWT auth cookies are httpOnly/Secure and must ride along on cross-origin
# requests from the Next.js frontend, so credentialed CORS is required.
CORS_ALLOW_CREDENTIALS = True

# Django's CSRF middleware checks the Origin header against this list on
# unsafe methods, independently of CORS_ALLOWED_ORIGINS above.
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=["http://localhost:3000"])


# --------------------------------------------------------------------------
# Django REST Framework / drf-spectacular
# --------------------------------------------------------------------------

REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "apps.users.authentication.CookieJWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.StandardResultsPagination",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Shordindu E-commerce API",
    "DESCRIPTION": "API for the Shordindu e-commerce platform.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}


# --------------------------------------------------------------------------
# JWT auth (issued as httpOnly cookies, never in the response body)
# --------------------------------------------------------------------------

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
}

# Cross-origin (localhost:3000 -> localhost:8000) but same-site, so Lax is
# enough to have the cookie ride along on normal fetch requests while still
# being withheld from cross-site POST/PUT/DELETE (the usual CSRF vector).
AUTH_COOKIE_ACCESS = "access_token"
AUTH_COOKIE_REFRESH = "refresh_token"
AUTH_COOKIE_SECURE = env.bool("AUTH_COOKIE_SECURE", default=not DEBUG)
AUTH_COOKIE_SAMESITE = env("AUTH_COOKIE_SAMESITE", default="Lax")
AUTH_COOKIE_DOMAIN = env("AUTH_COOKIE_DOMAIN", default=None) or None
# Refresh token only ever needs to be readable by the auth endpoints.
AUTH_COOKIE_REFRESH_PATH = "/api/auth/"


# --------------------------------------------------------------------------
# Celery
# --------------------------------------------------------------------------

CELERY_BROKER_URL = env("CELERY_BROKER_URL", default="redis://localhost:6379/0")
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", default="redis://localhost:6379/1")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE


# --------------------------------------------------------------------------
# Email (console backend in dev; SMTP-ready for prod)
# --------------------------------------------------------------------------

EMAIL_BACKEND = env("EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend")
EMAIL_HOST = env("EMAIL_HOST", default="")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="noreply@shordindu.com")