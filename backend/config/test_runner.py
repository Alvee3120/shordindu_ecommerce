"""Test runner that keeps the suite off remote storage.

With USE_S3=True in `backend/.env`, uploads performed by tests would go to the
real Cloudflare R2 bucket and stay there. Force local media storage for every
test run, whatever the environment says.
"""

from django.conf import settings
from django.test.runner import DiscoverRunner

LOCAL_STORAGE = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}


class LocalStorageDiscoverRunner(DiscoverRunner):
    def setup_test_environment(self, **kwargs):
        super().setup_test_environment(**kwargs)
        settings.STORAGES = LOCAL_STORAGE
        settings.USE_S3 = False
