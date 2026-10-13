"""Effective product prices — the single source of truth for automatic discounts.

    current price = variation base price (ProductVariation.price, never modified)
                    − the one discount that applies to it right now

Every place that prices a product goes through ``PricingEngine``: product
API responses, cart lines, checkout, CCE/admin dashboard orders and their
quotes. Orders then store the applied price as a snapshot.

Rules
-----
* Live discount: ``is_active`` and ``starts_at <= now <= ends_at``.
* Category discount: applies to products in the category **or any of its
  sub-categories** (same rule as the shop's category filter and analytics).
* No stacking — one discount per variation:
    1. a product-specific discount wins over any category discount;
    2. within that tier, the one giving the customer the larger saving on
       that variation wins; ties go to the later start, then the newer rule.
* A fixed discount larger than a variation's price doesn't apply to that
  variation (prices never go negative).
* Percentage savings are rounded to the poisha (2 dp, half-up).
* Coupons are separate: they apply afterwards to the order subtotal.
"""

from collections import defaultdict
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from django.utils import timezone

CENT = Decimal("0.01")


@dataclass(frozen=True)
class PriceQuote:
    base_price: Decimal
    final_price: Decimal
    discount: object = None  # apps.catalog.models.Discount or None

    @property
    def discount_amount(self):
        return self.base_price - self.final_price

    def discount_info(self):
        """Compact JSON-friendly description, or None when undiscounted."""
        if self.discount is None:
            return None
        return {
            "id": self.discount.id,
            "name": self.discount.name,
            "type": self.discount.type,
            "value": self.discount.value,
            "amount": self.discount_amount,
            "ends_at": self.discount.ends_at,
        }


def discount_amount(discount, base_price):
    """Saving a discount gives on ``base_price``, or None if it can't apply."""
    from .models import Discount

    if discount.type == Discount.Type.PERCENT:
        amount = (base_price * discount.value / Decimal("100")).quantize(CENT, rounding=ROUND_HALF_UP)
    else:
        amount = discount.value
    if amount <= 0 or amount > base_price:
        return None
    return amount


def category_with_descendants(category_id, parent_of=None):
    """Ids of a category and every category below it."""
    from .models import Category

    if parent_of is None:
        parent_of = dict(Category.objects.values_list("id", "parent_id"))
    children = defaultdict(list)
    for child, parent in parent_of.items():
        children[parent].append(child)
    result, stack = set(), [category_id]
    while stack:
        current = stack.pop()
        if current in result:
            continue
        result.add(current)
        stack.extend(children.get(current, []))
    return result


class PricingEngine:
    """Prices variations against the discounts live at ``now``.

    Loads the live discounts once (lazily), so one engine per request/serializer
    pass keeps pricing to a couple of queries regardless of product count.
    """

    def __init__(self, now=None):
        self.now = now or timezone.now()
        self._loaded = False

    def _load(self):
        from .models import Category, Discount

        live = list(Discount.objects.live(self.now).prefetch_related("products"))
        self._by_product = defaultdict(list)
        self._by_category = defaultdict(list)
        parent_of = None
        for discount in live:
            if discount.target_type == Discount.Target.PRODUCTS:
                for product in discount.products.all():
                    self._by_product[product.pk].append(discount)
            elif discount.category_id:
                if parent_of is None:
                    parent_of = dict(Category.objects.values_list("id", "parent_id"))
                for category_id in category_with_descendants(discount.category_id, parent_of):
                    self._by_category[category_id].append(discount)
        self._loaded = True

    @staticmethod
    def _best(candidates, base_price):
        best = None
        for discount in candidates:
            amount = discount_amount(discount, base_price)
            if amount is None:
                continue
            key = (amount, discount.starts_at, discount.id)
            if best is None or key > best[0]:
                best = (key, discount)
        return best[1] if best else None

    def quote(self, variation):
        if not self._loaded:
            self._load()
        base = variation.price
        product = variation.product

        discount = self._best(self._by_product.get(product.pk, ()), base)
        if discount is None and self._by_category:
            seen, candidates = set(), []
            # .all() uses prefetched categories when the caller prefetched them.
            for category in product.categories.all():
                for candidate in self._by_category.get(category.pk, ()):
                    if candidate.pk not in seen:
                        seen.add(candidate.pk)
                        candidates.append(candidate)
            discount = self._best(candidates, base)

        if discount is None:
            return PriceQuote(base_price=base, final_price=base)
        return PriceQuote(base_price=base, final_price=base - discount_amount(discount, base), discount=discount)

    def price(self, variation):
        return self.quote(variation).final_price


def discounted_product_ids(discount, engine):
    """Ids of storefront products whose price this discount sets right now.

    "Storefront" = active, not add-on-only (the shop listing's rules). A
    product counts only if at least one active variation is priced by *this*
    discount — e.g. a product whose own product-specific discount overrides a
    category discount appears under the product discount, not the category one.
    Newest products first, like the shop.
    """
    from .models import Discount, Product

    products = Product.objects.filter(status=Product.Status.ACTIVE).exclude(
        visibility_type=Product.VisibilityType.ADDON_ONLY
    )
    if discount.target_type == Discount.Target.PRODUCTS:
        products = products.filter(pk__in=discount.products.values("pk"))
    elif discount.category_id:
        products = products.filter(categories__in=category_with_descendants(discount.category_id))
    else:
        return []
    products = products.distinct().order_by("-created_at").prefetch_related("variations", "categories")

    ids = []
    for product in products:
        for variation in product.variations.all():
            if not variation.is_active:
                continue
            applied = engine.quote(variation).discount
            if applied is not None and applied.pk == discount.pk:
                ids.append(product.pk)
                break
    return ids


def pricing_engine_for(context):
    """One shared engine per serializer context (i.e. per API response)."""
    if context is None:
        return PricingEngine()
    engine = context.get("pricing_engine")
    if engine is None:
        engine = context["pricing_engine"] = PricingEngine()
    return engine
