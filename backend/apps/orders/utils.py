import random
import string

from django.utils import timezone


def generate_order_number():
    from .models import Order

    while True:
        candidate = f"ORD{timezone.now():%Y%m%d}{''.join(random.choices(string.digits, k=6))}"
        if not Order.objects.filter(order_number=candidate).exists():
            return candidate
