"""Copy files already in MEDIA_ROOT into the configured media storage (R2/S3).

Existing rows store relative paths like "products/bag.jpg" against files that
only ever lived on local disk. Once USE_S3 is flipped on, those rows resolve
against the bucket and 404. Run this once after switching storage:

    python manage.py upload_media_to_storage            # dry run, lists what it would copy
    python manage.py upload_media_to_storage --commit   # actually uploads

Files already present in the bucket are skipped, so re-running is safe.
"""

from pathlib import Path

from django.conf import settings
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Upload existing local MEDIA_ROOT files to the configured remote storage."

    def add_arguments(self, parser):
        parser.add_argument(
            "--commit",
            action="store_true",
            help="Perform the uploads. Without this flag the command only reports.",
        )

    def handle(self, *args, **options):
        if not settings.USE_S3:
            raise CommandError(
                "USE_S3 is False, so uploads already go to MEDIA_ROOT. Set USE_S3=True "
                "and configure the bucket before running this."
            )

        media_root = Path(settings.MEDIA_ROOT)
        if not media_root.is_dir():
            raise CommandError(f"MEDIA_ROOT does not exist: {media_root}")

        commit = options["commit"]
        files = sorted(p for p in media_root.rglob("*") if p.is_file())

        if not files:
            self.stdout.write("No local files to upload.")
            return

        copied = skipped = failed = 0
        for path in files:
            name = path.relative_to(media_root).as_posix()
            if default_storage.exists(name):
                skipped += 1
                continue
            if not commit:
                self.stdout.write(f"would upload: {name}")
                copied += 1
                continue
            try:
                with path.open("rb") as handle:
                    saved = default_storage.save(name, handle)
            except Exception as exc:  # keep going; report at the end
                failed += 1
                self.stderr.write(self.style.ERROR(f"failed: {name} ({exc})"))
                continue
            copied += 1
            if saved != name:
                # AWS_S3_FILE_OVERWRITE=False adds a suffix when the key is
                # taken; the stored DB path would no longer match the object.
                self.stderr.write(
                    self.style.WARNING(f"uploaded as {saved} (expected {name})")
                )

        verb = "uploaded" if commit else "would upload"
        self.stdout.write(
            self.style.SUCCESS(
                f"{verb}: {copied}, already present: {skipped}, failed: {failed}"
            )
        )
        if not commit and copied:
            self.stdout.write("Re-run with --commit to perform the uploads.")
