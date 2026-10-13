from collections import defaultdict
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import F, Sum

from apps.cart.cart_resolver import resolve_cart
from apps.catalog.models import InventoryLog, Product, ProductVariation
from apps.users.models import Address, User
from apps.users.utils import generate_secure_password

from .models import Coupon, DeliveryChargeSettings, Order, OrderCoupon, OrderItem, Payment
from .pricing import DeliveryZoneError, get_delivery_fee, normalize_zone, resolve_delivery_tier
from .utils import generate_order_number

ZERO = Decimal("0.00")

# InventoryLog reasons written for an order's stock movements. Summing an
# order's logs over these tells whether its stock is currently held, which is
# what makes cancel/reinstate safe to repeat (stock moves exactly once).
STOCK_PLACED = "order_placed"
STOCK_CANCELLED = "order_cancelled"
STOCK_REINSTATED = "order_reinstated"
ORDER_STOCK_REASONS = (STOCK_PLACED, STOCK_CANCELLED, STOCK_REINSTATED)


class CheckoutError(Exception):
    """A business-rule failure while placing or updating an order.

    ``errors`` is a DRF-style error dict, returned to the client as a 400.
    """

    def __init__(self, errors):
        self.errors = errors


# ---------------------------------------------------------------------------
# stock
# ---------------------------------------------------------------------------

def _decrement_stock(variation, quantity, order_number, reason=STOCK_PLACED):
    # Conditional UPDATE: the stock check and the decrement are one atomic
    # statement, so two concurrent orders can never oversell the same units.
    updated = ProductVariation.objects.filter(pk=variation.pk, stock_quantity__gte=quantity).update(
        stock_quantity=F("stock_quantity") - quantity
    )
    if not updated:
        available = ProductVariation.objects.filter(pk=variation.pk).values_list("stock_quantity", flat=True).first()
        raise CheckoutError(
            {
                "items": [
                    f"Not enough stock for {variation.product.name} ({variation.sku}): "
                    f"{available or 0} available, {quantity} requested."
                ]
            }
        )
    InventoryLog.objects.create(
        variation=variation, change_qty=-quantity, reason=reason, reference_id=order_number
    )


def _held_stock(order):
    """{variation_id: units this order currently holds} from its inventory logs."""
    rows = (
        InventoryLog.objects.filter(reference_id=order.order_number, reason__in=ORDER_STOCK_REASONS)
        .values("variation")
        .annotate(net=Sum("change_qty"))
    )
    return {row["variation"]: -row["net"] for row in rows if row["net"] < 0}


def _release_stock(order):
    for variation_id, quantity in _held_stock(order).items():
        ProductVariation.objects.filter(pk=variation_id).update(stock_quantity=F("stock_quantity") + quantity)
        InventoryLog.objects.create(
            variation_id=variation_id,
            change_qty=quantity,
            reason=STOCK_CANCELLED,
            reference_id=order.order_number,
        )


def _reserve_stock_again(order):
    if _held_stock(order):
        return  # already holding its stock (e.g. never actually released)
    needed = defaultdict(int)
    variations = {}
    for item in order.items.select_related("variation__product"):
        needed[item.variation_id] += item.quantity
        variations[item.variation_id] = item.variation
    for variation_id, quantity in needed.items():
        _decrement_stock(variations[variation_id], quantity, order.order_number, reason=STOCK_REINSTATED)


@transaction.atomic
def change_order_status(order, new_status):
    """Moves an order to ``new_status``, keeping inventory consistent.

    Cancelling releases the order's stock; moving a cancelled order back to
    any active status re-reserves it (failing if it's no longer available).
    Any other transition leaves stock untouched. The row lock serializes
    concurrent status changes so stock is released/reserved exactly once.
    """
    order = Order.objects.select_for_update().get(pk=order.pk)
    if order.status == new_status:
        return order

    if new_status == Order.Status.CANCELLED:
        _release_stock(order)
    elif order.status == Order.Status.CANCELLED:
        _reserve_stock_again(order)

    order.status = new_status
    order.save(update_fields=["status"])
    return order


# ---------------------------------------------------------------------------
# pricing + order creation (shared by checkout and CCE-created orders)
# ---------------------------------------------------------------------------

def _line_total(line):
    return line["unit_price"] * line["quantity"]


def _subtotal(lines):
    return sum(
        (_line_total(line) + sum((_line_total(child) for child in line["children"]), ZERO) for line in lines),
        ZERO,
    )


def _apply_coupon(coupon_code, subtotal):
    if not coupon_code:
        return None, ZERO
    coupon = Coupon.objects.filter(code__iexact=coupon_code.strip()).first()
    if not coupon or not coupon.is_valid_for(subtotal):
        raise CheckoutError({"coupon_code": ["Invalid or inapplicable coupon."]})
    return coupon, coupon.compute_discount(subtotal)


def _delivery_fee(district, zone):
    try:
        return get_delivery_fee(district, zone)
    except DeliveryZoneError as exc:
        raise CheckoutError({"shipping_zone": [str(exc)]})


def _create_order(*, lines, address, user, guest_email, coupon_code, **order_fields):
    """Prices ``lines`` server-side and writes the order, items, stock and payment.

    ``lines``: [{product, variation, quantity, unit_price, children: [...]}].
    Total = subtotal − discount + delivery + tax (tax is always 0 today).
    """
    subtotal = _subtotal(lines)
    coupon, discount_total = _apply_coupon(coupon_code, subtotal)
    shipping_total = _delivery_fee(address.district, address.zone)
    tax_total = ZERO
    grand_total = subtotal - discount_total + shipping_total + tax_total

    order = Order.objects.create(
        order_number=generate_order_number(),
        user=user,
        guest_email=guest_email,
        subtotal=subtotal,
        discount_total=discount_total,
        shipping_total=shipping_total,
        tax_total=tax_total,
        grand_total=grand_total,
        shipping_address=address,
        billing_address=address,
        **order_fields,
    )

    def write_item(line, parent=None):
        item = OrderItem.objects.create(
            order=order,
            product=line["product"],
            variation=line["variation"],
            product_name_snapshot=line["product"].name,
            variation_label_snapshot=line["variation"].sku,
            quantity=line["quantity"],
            unit_price=line["unit_price"],
            line_total=_line_total(line),
            parent_order_item=parent,
        )
        _decrement_stock(line["variation"], line["quantity"], order.order_number)
        return item

    for line in lines:
        parent = write_item(line)
        for child in line["children"]:
            write_item(child, parent)

    if coupon:
        OrderCoupon.objects.create(order=order, coupon=coupon, discount_amount=discount_total)

    Payment.objects.create(order=order, method=Payment.Method.COD, amount=grand_total)
    return order


def _cart_line(item):
    return {
        "product": item.product,
        "variation": item.variation,
        "quantity": item.quantity,
        "unit_price": item.unit_price_snapshot,
        "children": [],
    }


@transaction.atomic
def checkout(request, data):
    cart, _ = resolve_cart(request)
    top_level_items = list(
        cart.items.filter(parent_cart_item__isnull=True)
        .select_related("product", "variation")
        .prefetch_related("children__product", "children__variation")
    )
    if not top_level_items:
        raise CheckoutError({"detail": "Cart is empty."})

    user = request.user if request.user.is_authenticated else None
    created_account_password = None
    guest_email = None

    district = data.get("shipping_district", "")
    inline_address = {
        "name": data.get("shipping_name", ""),
        "phone": data.get("shipping_phone", ""),
        "address": data.get("shipping_address", ""),
        "district": district,
        "zone": normalize_zone(district, data.get("shipping_zone")),
    }

    if user:
        if data.get("shipping_address_id"):
            address = Address.objects.filter(pk=data["shipping_address_id"], user=user).first()
            if not address:
                raise CheckoutError({"shipping_address_id": ["Address not found."]})
        else:
            address = Address.objects.create(
                user=user,
                **{
                    **inline_address,
                    "name": inline_address["name"] or user.name,
                    "phone": inline_address["phone"] or user.phone,
                },
            )
    elif data["create_account"]:
        password = generate_secure_password()
        user = User.objects.create_user(
            email=data["email"],
            password=password,
            name=data.get("shipping_name") or data["email"],
            phone=data.get("shipping_phone", ""),
            force_password_change=True,
        )
        created_account_password = password
        address = Address.objects.create(user=user, **inline_address)
    else:
        guest_email = data["email"]
        address = Address.objects.create(user=None, **inline_address)

    lines = []
    for item in top_level_items:
        line = _cart_line(item)
        line["children"] = [_cart_line(child) for child in item.children.all()]
        lines.append(line)

    order = _create_order(
        lines=lines,
        address=address,
        user=user,
        guest_email=guest_email,
        coupon_code=data.get("coupon_code"),
        note=data.get("order_note", ""),
    )

    cart.delete()

    return order, created_account_password


# ---------------------------------------------------------------------------
# CCE / admin dashboard orders
# ---------------------------------------------------------------------------

def _manual_lines(items):
    """Builds priced order lines from [{variation, quantity}] using current
    catalog prices and availability — client-sent prices/stock are never used."""
    quantities = defaultdict(int)
    for item in items:
        quantities[item["variation"].pk] += item["quantity"]

    variations = ProductVariation.objects.select_related("product").in_bulk(list(quantities))
    lines, errors = [], []
    for variation_id, quantity in quantities.items():
        variation = variations[variation_id]
        product = variation.product
        label = f"{product.name} ({variation.sku})"
        if product.status != Product.Status.ACTIVE or not variation.is_active:
            errors.append(f"{label} is not available for sale.")
        elif variation.stock_quantity < quantity:
            errors.append(f"Not enough stock for {label}: {variation.stock_quantity} available, {quantity} requested.")
        lines.append(
            {
                "product": product,
                "variation": variation,
                "quantity": quantity,
                "unit_price": variation.price,
                "children": [],
            }
        )
    if errors:
        raise CheckoutError({"items": errors})
    return lines


def quote_manual_order(data):
    """Server-side totals for a dashboard order, without writing anything.

    Uses exactly the same pricing helpers as order creation, so the summary
    the CCE sees before submitting always matches what gets stored.
    """
    lines = _manual_lines(data["items"])
    subtotal = _subtotal(lines)
    coupon, discount_total = _apply_coupon(data.get("coupon_code"), subtotal)

    district = data.get("district", "")
    zone = normalize_zone(district, data.get("zone"))
    try:
        tier = resolve_delivery_tier(district, zone)
        shipping_total = DeliveryChargeSettings.load().amount_for(tier)
    except DeliveryZoneError:
        tier, shipping_total = None, None

    return {
        "items": [
            {
                "variation": line["variation"].pk,
                "product": line["product"].pk,
                "product_name": line["product"].name,
                "sku": line["variation"].sku,
                "unit_price": line["unit_price"],
                "quantity": line["quantity"],
                "line_total": _line_total(line),
                "available_stock": line["variation"].stock_quantity,
            }
            for line in lines
        ],
        "subtotal": subtotal,
        "coupon_code": coupon.code if coupon else None,
        "discount_total": discount_total,
        "delivery_tier": tier,
        "shipping_total": shipping_total,
        "grand_total": subtotal - discount_total + (shipping_total or ZERO),
    }


def create_manual_order(request, data):
    """Creates an order entered by a CCE/admin. Returns ``(order, created)``.

    Repeating a request with the same ``client_request_id`` returns the order
    the first request created (``created=False``) instead of a duplicate.
    """
    request_id = data.get("client_request_id")
    if request_id:
        existing = Order.objects.filter(client_request_id=request_id).first()
        if existing:
            return existing, False

    try:
        with transaction.atomic():
            return _create_manual_order(request, data), True
    except IntegrityError:
        # A concurrent duplicate of the same request won the race on the
        # unique client_request_id — hand back the order it created.
        existing = Order.objects.filter(client_request_id=request_id).first() if request_id else None
        if existing:
            return existing, False
        raise


def _create_manual_order(request, data):
    lines = _manual_lines(data["items"])
    customer = data.get("customer")

    # The delivery details are a per-order snapshot (an unowned Address row),
    # so editing them here never changes the customer's saved address book.
    district = data["district"]
    address = Address.objects.create(
        user=None,
        name=data["name"],
        phone=data["phone"],
        address=data["address"],
        district=district,
        zone=normalize_zone(district, data.get("zone")),
    )

    email = (data.get("email") or "").strip()
    return _create_order(
        lines=lines,
        address=address,
        user=customer,
        guest_email=None if customer else (email or None),
        coupon_code=data.get("coupon_code"),
        note=data.get("note", ""),
        created_by=request.user,
        client_request_id=data.get("client_request_id"),
    )
