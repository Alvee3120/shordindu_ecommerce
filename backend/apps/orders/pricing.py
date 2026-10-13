"""Delivery-charge rules — the single source of truth for every delivery fee.

The *amounts* live in the admin-editable ``DeliveryChargeSettings`` row; this
module owns the *rules* that map a shipping district (+ Dhaka zone) to one of
the three charge tiers. Checkout, CCE-created orders and the public
``/api/delivery-charges/`` endpoint (which the frontend reads) all go through
here, so no fee is ever hardcoded anywhere else.
"""

from decimal import Decimal

DHAKA_DISTRICT = "Dhaka"

INSIDE_DHAKA = "inside_dhaka"
DHAKA_OUTER_ZONES = "dhaka_outer_zones"
OUTSIDE_DHAKA = "outside_dhaka"

TIER_LABELS = {
    INSIDE_DHAKA: "Inside Dhaka",
    DHAKA_OUTER_ZONES: "Dhaka Outer Zones",
    OUTSIDE_DHAKA: "Outside Dhaka",
}

# Zone -> charge tier, for addresses in the Dhaka district. Order matters: it
# is the order the zone dropdown is shown in.
DHAKA_ZONES = {
    "Dhaka Sadar": INSIDE_DHAKA,
    "Dhamrai": DHAKA_OUTER_ZONES,
    "Dohar": DHAKA_OUTER_ZONES,
    "Keraniganj": DHAKA_OUTER_ZONES,
    "Nawabganj": DHAKA_OUTER_ZONES,
    "Savar": DHAKA_OUTER_ZONES,
}

DEFAULT_CHARGES = {
    INSIDE_DHAKA: Decimal("70.00"),
    DHAKA_OUTER_ZONES: Decimal("100.00"),
    OUTSIDE_DHAKA: Decimal("120.00"),
}


class DeliveryZoneError(ValueError):
    """The address doesn't carry enough information to price its delivery."""


def is_dhaka(district):
    return bool(district) and district.strip().lower() == DHAKA_DISTRICT.lower()


def normalize_zone(district, zone):
    """Zones only exist inside Dhaka — any zone sent for another district is dropped."""
    return (zone or "").strip() if is_dhaka(district) else ""


def resolve_delivery_tier(district, zone=""):
    """Returns the charge tier key for an address, or raises ``DeliveryZoneError``."""
    if not district or not district.strip():
        raise DeliveryZoneError("Select a district to calculate the delivery charge.")
    if not is_dhaka(district):
        return OUTSIDE_DHAKA
    tier = DHAKA_ZONES.get((zone or "").strip())
    if tier is None:
        raise DeliveryZoneError("Select a Dhaka zone to calculate the delivery charge.")
    return tier


def get_delivery_fee(district, zone="", charges=None):
    """The current configured delivery fee for an address.

    ``charges`` is a ``DeliveryChargeSettings`` instance; it's loaded when
    omitted. Raises ``DeliveryZoneError`` when the address can't be priced.
    """
    from .models import DeliveryChargeSettings

    tier = resolve_delivery_tier(district, zone)
    charges = charges or DeliveryChargeSettings.load()
    return charges.amount_for(tier)
