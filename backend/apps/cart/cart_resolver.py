import uuid

from django.conf import settings

from .models import Cart

CART_COOKIE_NAME = "cart_token"


def resolve_cart(request):
    """Returns (cart, new_token_to_set_or_None)."""
    if request.user.is_authenticated:
        cart, _ = Cart.objects.get_or_create(user=request.user)
        return cart, None

    raw_token = request.COOKIES.get(CART_COOKIE_NAME)
    if raw_token:
        try:
            token = uuid.UUID(raw_token)
        except ValueError:
            token = None
        if token:
            cart = Cart.objects.filter(token=token, user__isnull=True).first()
            if cart:
                return cart, None

    cart = Cart.objects.create()
    return cart, cart.token


class CartMixin:
    """Resolves the request's cart (guest-token or user) and, when a brand new
    guest cart is created, attaches the cart_token cookie to the response."""

    def get_cart(self, request):
        cart, new_token = resolve_cart(request)
        self._new_cart_token = new_token
        return cart

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        new_token = getattr(self, "_new_cart_token", None)
        if new_token:
            response.set_cookie(
                CART_COOKIE_NAME,
                str(new_token),
                httponly=True,
                secure=settings.AUTH_COOKIE_SECURE,
                samesite=settings.AUTH_COOKIE_SAMESITE,
                path="/",
            )
        return response
