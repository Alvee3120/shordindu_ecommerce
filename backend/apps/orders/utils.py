import random
import string

from django.utils import timezone


def generate_order_number(when=None):
    from .models import Order

    # Local time, not UTC: the dashboard renders placed_at in settings.TIME_ZONE,
    # so a UTC stamp would put yesterday's date in the number for any order
    # placed after 18:00 Dhaka. Pass `when` to stamp a backdated order.
    when = when or timezone.now()
    stamp = timezone.localtime(when).strftime("%Y%m%d")
    while True:
        candidate = f"ORD{stamp}{''.join(random.choices(string.digits, k=6))}"
        if not Order.objects.filter(order_number=candidate).exists():
            return candidate
