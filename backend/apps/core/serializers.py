from urllib.parse import urlsplit

from rest_framework import serializers

from .models import CampaignBanner

MAX_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP"}
MAX_HEADING_LINES = 4


def validate_button_url(value):
    """Allow only same-site paths ("/shop") or absolute http(s) URLs.

    Rejects javascript:/data:/other schemes, protocol-relative "//host"
    links, backslash tricks and any whitespace/control characters.
    """
    value = (value or "").strip()
    if not value:
        return value
    if any(ch.isspace() or ord(ch) < 32 or ord(ch) == 127 for ch in value) or "\\" in value:
        raise serializers.ValidationError("The URL can't contain spaces or special characters.")
    if value.startswith("/"):
        if value.startswith("//"):
            raise serializers.ValidationError("Use a path like /shop or a full https:// URL.")
        return value
    parts = urlsplit(value)
    if parts.scheme in ("http", "https") and parts.netloc:
        return value
    raise serializers.ValidationError("Use a path like /shop or a full https:// URL.")


def _absolute(request, field_file):
    if not field_file:
        return None
    url = field_file.url
    return request.build_absolute_uri(url) if request else url


class PublicCampaignBannerSerializer(serializers.ModelSerializer):
    """What the homepage renders — no scheduling or admin metadata."""

    desktop_image_url = serializers.SerializerMethodField()
    mobile_image_url = serializers.SerializerMethodField()
    image_alt = serializers.SerializerMethodField()

    class Meta:
        model = CampaignBanner
        fields = [
            "image_mode",
            "desktop_image_url",
            "mobile_image_url",
            "image_alt",
            "eyebrow",
            "heading",
            "description",
            "button_enabled",
            "button_label",
            "button_url",
            "updated_at",
        ]

    def get_desktop_image_url(self, obj):
        return _absolute(self.context.get("request"), obj.desktop_image)

    def get_mobile_image_url(self, obj):
        return _absolute(self.context.get("request"), obj.mobile_image)

    def get_image_alt(self, obj):
        return obj.image_alt or " ".join(obj.heading.split())


class CampaignBannerAdminSerializer(PublicCampaignBannerSerializer):
    """Full configuration for the admin form (multipart: text fields + images)."""

    desktop_image = serializers.ImageField(required=False, write_only=True)
    mobile_image = serializers.ImageField(required=False, write_only=True)
    remove_desktop_image = serializers.BooleanField(required=False, default=False, write_only=True)
    remove_mobile_image = serializers.BooleanField(required=False, default=False, write_only=True)
    image_alt = serializers.CharField(max_length=150, required=False, allow_blank=True)
    status = serializers.SerializerMethodField()
    updated_by_name = serializers.CharField(source="updated_by.name", read_only=True, default=None)

    class Meta(PublicCampaignBannerSerializer.Meta):
        fields = PublicCampaignBannerSerializer.Meta.fields + [
            "is_enabled",
            "starts_at",
            "ends_at",
            "desktop_image",
            "mobile_image",
            "remove_desktop_image",
            "remove_mobile_image",
            "status",
            "created_at",
            "updated_by_name",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def get_status(self, obj):
        return obj.status_at()

    # -- field validation ---------------------------------------------------

    def _validate_image(self, image):
        if image.size > MAX_IMAGE_BYTES:
            raise serializers.ValidationError("Images must be 5 MB or smaller.")
        # serializers.ImageField has already verified it's a real image (Pillow).
        fmt = getattr(getattr(image, "image", None), "format", None)
        if fmt and fmt.upper() not in ALLOWED_IMAGE_FORMATS:
            raise serializers.ValidationError("Use a JPEG, PNG or WebP image.")
        return image

    def validate_desktop_image(self, image):
        return self._validate_image(image)

    def validate_mobile_image(self, image):
        return self._validate_image(image)

    def validate_heading(self, value):
        lines = [line.strip() for line in value.replace("\r\n", "\n").split("\n")]
        lines = [line for line in lines if line]
        if not lines:
            raise serializers.ValidationError("A heading is required.")
        if len(lines) > MAX_HEADING_LINES:
            raise serializers.ValidationError(f"Use at most {MAX_HEADING_LINES} lines.")
        return "\n".join(lines)

    def validate_eyebrow(self, value):
        return value.strip()

    def validate_description(self, value):
        return value.strip()

    def validate_button_label(self, value):
        return value.strip()

    def validate_image_alt(self, value):
        return value.strip()

    def validate_button_url(self, value):
        return validate_button_url(value)

    def validate(self, attrs):
        instance = self.instance

        def final(name):
            return attrs[name] if name in attrs else getattr(instance, name, None)

        starts_at, ends_at = final("starts_at"), final("ends_at")
        if starts_at and ends_at and ends_at <= starts_at:
            raise serializers.ValidationError({"ends_at": ["The end date must be after the start date."]})

        if final("button_enabled"):
            errors = {}
            if not final("button_label"):
                errors["button_label"] = ["Enter the button text, or turn the button off."]
            if not final("button_url"):
                errors["button_url"] = ["Enter where the button links to, or turn the button off."]
            if errors:
                raise serializers.ValidationError(errors)

        # The images the banner will have once this request is applied.
        has_desktop = bool(attrs.get("desktop_image")) or (
            not attrs.get("remove_desktop_image") and bool(instance and instance.desktop_image)
        )
        has_mobile = bool(attrs.get("mobile_image")) or (
            not attrs.get("remove_mobile_image") and bool(instance and instance.mobile_image)
        )
        if final("is_enabled"):
            mode = final("image_mode")
            if mode == CampaignBanner.ImageMode.MOBILE and not has_mobile:
                raise serializers.ValidationError({"mobile_image": ["Upload a mobile image for this display mode."]})
            if mode != CampaignBanner.ImageMode.MOBILE and not has_desktop:
                raise serializers.ValidationError(
                    {"desktop_image": ["Upload a desktop image before enabling the banner."]}
                )
        return attrs

    def update(self, instance, validated_data):
        for field in ("desktop_image", "mobile_image"):
            if validated_data.pop(f"remove_{field}", False) and field not in validated_data:
                validated_data[field] = ""  # the column is NOT NULL; "" means no file
        # Old files are left in storage on purpose: the homepage is cached for
        # up to a minute and may still reference the previous image URL.
        return super().update(instance, validated_data)
