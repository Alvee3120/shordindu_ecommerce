from decimal import Decimal

# Mirrors frontend/src/lib/districts.js — keep both in sync if the fee schedule changes.
DHAKA_DISTRICT = "Dhaka"
DHAKA_DELIVERY_FEE = Decimal("70.00")
OUTSIDE_DHAKA_DELIVERY_FEE = Decimal("120.00")


def get_delivery_fee(district):
    """Returns the delivery fee for a shipping district. No district -> no fee."""
    if not district:
        return Decimal("0.00")
    is_dhaka = district.strip().lower() == DHAKA_DISTRICT.lower()
    return DHAKA_DELIVERY_FEE if is_dhaka else OUTSIDE_DHAKA_DELIVERY_FEE
