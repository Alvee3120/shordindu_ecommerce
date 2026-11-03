"""Basket-level promotional offers — the single source of truth for the
buy-X-get-Y / bundle discounts.

Unlike ``apps.catalog.pricing`` (which lowers the price of one variation), these
offers only make sense against a *group of units* sitting in one cart or order
and are therefore applied once per basket, never to a stored product price.

Model
-----
* **unit** — one purchasable unit of an eligible line. A cart/order line of
  quantity *n* contributes *n* units, all sharing the line's effective unit
  price (the base price after any per-item discount).
* **group** — ``group_size`` consecutive eligible units that one application of
  the offer covers. The customer only benefits from *complete* groups; leftover
  units never form a partial group.
* **eligible** — a unit whose product is targeted by the offer (specific
  products, or a category **including all of its descendants**).

Offer shapes (``group_plan``)
-----------------------------
* ``bxgy_percent``  — group = X units, benefit = Y% off the group subtotal.
* ``bxgy_free``     — group = X + Y units, benefit = the Y cheapest units free.
* ``lowest_free``   — group = X units, benefit = the cheapest unit free.
* ``three_for_two`` — group = 3 units, benefit = the cheapest unit free.
* ``bundle_price``  — group = X units, benefit = group subtotal − ৳Y (never
  negative, and skipped entirely when the group is already cheaper than ৳Y).

Deterministic rules
-------------------
* Units are grouped in a stable order (by variation id, then line id), so the
  same basket always produces the same result.
* Within a group that yields free units, the *cheapest* units are free; ties
  break by variation id, then line id.
* Discounts are allocated to lines in proportion to the units' prices; the last
  unit of a group absorbs the rounding remainder so ``Σ line discounts`` always
  equals the group discount exactly (order totals stay consistent).
* Each unit is consumed by at most one offer: offers run in priority order
  (product-specific before category; then newest first) and a consumed unit is
  never offered to a later offer. So the same units can never receive two
  incompatible free-item/bundle offers.
"""

from collections import defaultdict
from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal

from django.utils import timezone

from .pricing import categories_with_descendants

CENT = Decimal("0.01")
ZERO = Decimal("0.00")


@dataclass(frozen=True)
class Unit:
    """One purchasable unit in the basket."""

    line_key: int
    product_id: int
    variation_id: int
    price: Decimal
    category_ids: frozenset = frozenset()


@dataclass
class AppliedPromotion:
    discount_id: int
    name: str
    type: str
    label: str
    qualifying_quantity: int
    free_quantity: int
    discount_amount: Decimal
    bundle_price: object = None
    line_discounts: dict = field(default_factory=dict)
    line_free_qty: dict = field(default_factory=dict)
    consumed: tuple = ()

    def to_dict(self):
        return {
            "id": self.discount_id,
            "name": self.name,
            "type": self.type,
            "label": self.label,
            "qualifying_quantity": self.qualifying_quantity,
            "free_quantity": self.free_quantity,
            "discount_amount": self.discount_amount,
            "bundle_price": self.bundle_price,
            "line_discounts": {str(k): v for k, v in self.line_discounts.items()},
            "line_free_qty": {str(k): v for k, v in self.line_free_qty.items()},
        }


def group_plan(discount):
    """(group_size, free_count, percent_off, bundle_price) or None if invalid."""
    from .models import Discount

    t = discount.type
    if t == Discount.Type.BXGY_PERCENT:
        return (discount.min_quantity, 0, discount.percent_off, None)
    if t == Discount.Type.BXGY_FREE:
        if discount.min_quantity is None or discount.free_quantity is None:
            return None
        return (discount.min_quantity + discount.free_quantity, discount.free_quantity, None, None)
    if t == Discount.Type.LOWEST_FREE:
        return (discount.min_quantity, 1, None, None)
    if t == Discount.Type.THREE_FOR_TWO:
        return (3, 1, None, None)
    if t == Discount.Type.BUNDLE_PRICE:
        return (discount.min_quantity, 0, None, discount.bundle_price)
    return None


def _to_cents(value):
    return int((value * 100).to_integral_value(rounding=ROUND_HALF_UP))


def _allocate_proportional(group, amount, out):
    """Split ``amount`` across a group's units by price, summing **exactly**.

    Uses the largest-remainder method in whole poisha: each unit's share is
    proportional to its price and never exceeds that price, and the whole amount
    is distributed — so ``Σ line discounts == group discount`` with no drift.
    """
    total_cents = sum((_to_cents(unit.price) for _, unit in group), 0)
    amount_cents = _to_cents(amount)
    if total_cents <= 0 or amount_cents <= 0:
        return
    shares = []
    assigned = 0
    for _, unit in group:
        price_cents = _to_cents(unit.price)
        exact = amount_cents * price_cents / total_cents
        floor = int(exact)
        shares.append([unit, floor, exact - floor])
        assigned += floor
    leftover = amount_cents - assigned
    for entry in sorted(shares, key=lambda s: s[2], reverse=True):
        if leftover <= 0:
            break
        entry[1] += 1
        leftover -= 1
    for unit, cents, _ in shares:
        out[unit.line_key] += Decimal(cents) / 100


def _group_units(pairs, group_size, per_product):
    """Chunk eligible (index, unit) pairs into complete groups, deterministically."""
    groups = []
    if per_product:
        by_product = defaultdict(list)
        for pair in pairs:
            by_product[pair[1].product_id].append(pair)
        buckets = [sorted(by_product[pid], key=lambda p: (p[1].variation_id, p[0])) for pid in sorted(by_product)]
    else:
        buckets = [sorted(pairs, key=lambda p: (p[1].variation_id, p[0]))]
    for bucket in buckets:
        for i in range(0, len(bucket) - group_size + 1, group_size):
            groups.append(bucket[i : i + group_size])
    return groups


class PromotionEngine:
    """Applies every live basket offer to a list of :class:`Unit`.

    Loads the live offers once so one engine per request keeps the work to a
    single query regardless of basket size.
    """

    def __init__(self, now=None):
        self.now = now or timezone.now()
        self._loaded = False

    def _load(self):
        from .models import Category, Discount

        live = list(Discount.objects.live(self.now).basket().prefetch_related("products", "categories"))
        self._ordered = sorted(
            live,
            key=lambda d: (
                0 if d.target_type == Discount.Target.PRODUCTS else 1,
                -d.starts_at.timestamp(),
                -d.id,
            ),
        )
        parent_of = None
        self._product_targets = {}
        self._category_targets = {}
        for discount in live:
            if discount.target_type == Discount.Target.PRODUCTS:
                self._product_targets[discount.id] = {p.pk for p in discount.products.all()}
            elif discount.target_type == Discount.Target.CATEGORY:
                if parent_of is None:
                    parent_of = dict(Category.objects.values_list("id", "parent_id"))
                self._category_targets[discount.id] = categories_with_descendants(
                    [c.pk for c in discount.categories.all()], parent_of
                )
        self._loaded = True

    def _is_eligible(self, discount, unit):
        products = self._product_targets.get(discount.id)
        if products is not None:
            return unit.product_id in products
        categories = self._category_targets.get(discount.id)
        if categories:
            return bool(categories & unit.category_ids)
        return False

    @staticmethod
    def _apply_one(discount, pairs):
        from .models import Discount

        if not pairs:
            return None
        plan = group_plan(discount)
        if not plan:
            return None
        group_size, free_count, percent_off, bundle_price = plan
        if not group_size or group_size < 1:
            return None
        if discount.type == Discount.Type.BXGY_PERCENT and (percent_off is None or percent_off <= 0):
            return None
        if discount.type == Discount.Type.BUNDLE_PRICE and bundle_price is None:
            return None
        if discount.type == Discount.Type.THREE_FOR_TWO:
            group_size, free_count = 3, 1

        per_product = discount.type == Discount.Type.BXGY_FREE and discount.free_same_product
        groups = _group_units(pairs, group_size, per_product)
        if not groups:
            return None

        line_discounts = defaultdict(lambda: ZERO)
        line_free = defaultdict(int)
        consumed = []
        total = ZERO
        qualifying = 0
        free_total = 0

        for group in groups:
            group_total = sum((unit.price for _, unit in group), ZERO)
            group_discount = ZERO
            if discount.type == Discount.Type.BXGY_PERCENT:
                group_discount = min((group_total * percent_off / Decimal("100")).quantize(CENT, ROUND_HALF_UP), group_total)
            elif discount.type == Discount.Type.BUNDLE_PRICE:
                group_discount = group_total - bundle_price
            else:  # bxgy_free / lowest_free
                cheapest = sorted(group, key=lambda p: (p[1].price, p[1].variation_id, p[0]))
                for _, unit in cheapest[:free_count]:
                    group_discount += unit.price
                    line_discounts[unit.line_key] += unit.price
                    line_free[unit.line_key] += 1
                    free_total += 1

            if group_discount <= 0:
                continue  # incomplete or not cheaper — group yields nothing
            if discount.type in (Discount.Type.BXGY_PERCENT, Discount.Type.BUNDLE_PRICE):
                _allocate_proportional(group, group_discount, line_discounts)
            total += group_discount
            qualifying += group_size
            consumed.extend(index for index, _ in group)

        if total <= 0:
            return None
        return AppliedPromotion(
            discount_id=discount.id,
            name=discount.name,
            type=discount.type,
            label=discount.label(),
            qualifying_quantity=qualifying,
            free_quantity=free_total,
            discount_amount=total,
            bundle_price=bundle_price,
            line_discounts=dict(line_discounts),
            line_free_qty=dict(line_free),
            consumed=tuple(consumed),
        )

    def apply(self, units):
        """Return the offers that apply to ``units`` (each unit used at most once)."""
        if not self._loaded:
            self._load()
        units = list(units)
        used = set()
        applied = []
        for discount in self._ordered:
            pairs = [
                (i, unit)
                for i, unit in enumerate(units)
                if i not in used and self._is_eligible(discount, unit)
            ]
            result = self._apply_one(discount, pairs)
            if result is not None:
                applied.append(result)
                used.update(result.consumed)
        return applied


def units_from_lines(lines):
    """Expand order/cart line dicts ({product, variation, quantity, unit_price})
    into :class:`Unit`s, keyed by the line's index in ``lines``."""
    from .models import Product

    product_ids = {line["product"].pk for line in lines}
    categories_of = defaultdict(set)
    if product_ids:
        through = Product.categories.through
        for product_id, category_id in through.objects.filter(product_id__in=product_ids).values_list(
            "product_id", "category_id"
        ):
            categories_of[product_id].add(category_id)

    units = []
    for index, line in enumerate(lines):
        category_ids = frozenset(categories_of.get(line["product"].pk, ()))
        for _ in range(line["quantity"]):
            units.append(
                Unit(
                    line_key=index,
                    product_id=line["product"].pk,
                    variation_id=line["variation"].pk,
                    price=line["unit_price"],
                    category_ids=category_ids,
                )
            )
    return units


def promotion_product_ids(discount):
    """Ids of storefront products an offer targets right now.

    Same storefront rules as ``discounted_product_ids`` (active, not add-on
    only, newest first). Basket offers don't change a product's single-item
    price, so every eligible product is listed — the offer is realised in cart.
    """
    from .models import Discount, Product

    products = Product.objects.filter(status=Product.Status.ACTIVE).exclude(
        visibility_type=Product.VisibilityType.ADDON_ONLY
    )
    if discount.target_type == Discount.Target.PRODUCTS:
        products = products.filter(pk__in=discount.products.values("pk"))
    elif discount.categories.exists():
        ids = categories_with_descendants(discount.categories.values_list("pk", flat=True))
        products = products.filter(categories__in=ids)
    else:
        return []
    return list(products.distinct().order_by("-created_at").values_list("pk", flat=True))
