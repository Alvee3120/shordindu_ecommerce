from django.conf import settings
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication


class CookieJWTAuthentication(JWTAuthentication):
    """Reads the access token from an httpOnly cookie instead of the Authorization header."""

    def authenticate(self, request):
        raw_token = request.COOKIES.get(settings.AUTH_COOKIE_ACCESS)
        if raw_token is None:
            return None
        try:
            validated_token = self.get_validated_token(raw_token)
            return self.get_user(validated_token), validated_token
        except AuthenticationFailed:
            # A stale or foreign cookie must not break public reads. Treat the
            # request as anonymous; protected views still answer 401 via their
            # permissions, which is what triggers the frontend's token refresh.
            return None
