from decimal import Decimal

from django.db import transaction
from django.db.models import F

from apps.cart.cart_resolver import resolve_cart
from apps.catalog.models import InventoryLog, ProductVariation
from apps.users.models import Address, User
from apps.users.utils import generate_secure_password

from .models import Coupon, Order, OrderCoupon, OrderItem, Payment
from .pricing import get_delivery_fee
from .utils import generate_order_number


class CheckoutError(Exception):
    def __init__(self, errors):
        self.errors = errors


def _decrement_stock(variation, quantity, order_number):
    ProductVariation.objects.filter(pk=variation.pk).update(stock_quantity=F("stock_quantity") - quantity)
    InventoryLog.objects.create(
        variation=variation,
        change_qty=-quantity,
        reason="order_placed",
        reference_id=order_number,
    )


@transaction.atomic
def checkout(request, data):
    cart, _ = resolve_cart(request)
    top_level_items = list(cart.items.filter(parent_cart_item__isnull=True).prefetch_related("children"))
    if not top_level_items:
        raise CheckoutError({"detail": "Cart is empty."})

    user = request.user if request.user.is_authenticated else None
    created_account_password = None
    guest_email = None

    if user:
        if data.get("shipping_address_id"):
            address = Address.objects.filter(pk=data["shipping_address_id"], user=user).first()
            if not address:
                raise CheckoutError({"shipping_address_id": ["Address not found."]})
        else:
            address = Address.objects.create(
                user=user,
                name=data.get("shipping_name") or user.name,
                phone=data.get("shipping_phone") or user.phone,
                address=data["shipping_address"],
                district=data.get("shipping_district", ""),
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
        address = Address.objects.create(
            user=user,
            name=data.get("shipping_name", ""),
            phone=data.get("shipping_phone", ""),
            address=data["shipping_address"],
            district=data.get("shipping_district", ""),
        )
    else:
        guest_email = data["email"]
        address = Address.objects.create(
            user=None,
            name=data.get("shipping_name", ""),
            phone=data.get("shipping_phone", ""),
            address=data["shipping_address"],
            district=data.get("shipping_district", ""),
        )

    subtotal = sum((item.unit_price_snapshot * item.quantity for item in cart.items.all()), Decimal("0.00"))

    discount_total = Decimal("0.00")
    coupon = None
    if data.get("coupon_code"):
        coupon = Coupon.objects.filter(code__iexact=data["coupon_code"]).first()
        if not coupon or not coupon.is_valid_for(subtotal):
            raise CheckoutError({"coupon_code": ["Invalid or inapplicable coupon."]})
        discount_total = coupon.compute_discount(subtotal)

    shipping_total = get_delivery_fee(address.district)
    tax_total = Decimal("0.00")
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
    )

    for item in top_level_items:
        order_item = OrderItem.objects.create(
            order=order,
            product=item.product,
            variation=item.variation,
            product_name_snapshot=item.product.name,
            variation_label_snapshot=item.variation.sku,
            quantity=item.quantity,
            unit_price=item.unit_price_snapshot,
            line_total=item.unit_price_snapshot * item.quantity,
        )
        _decrement_stock(item.variation, item.quantity, order.order_number)
        for child in item.children.all():
            OrderItem.objects.create(
                order=order,
                product=child.product,
                variation=child.variation,
                product_name_snapshot=child.product.name,
                variation_label_snapshot=child.variation.sku,
                quantity=child.quantity,
                unit_price=child.unit_price_snapshot,
                line_total=child.unit_price_snapshot * child.quantity,
                parent_order_item=order_item,
            )
            _decrement_stock(child.variation, child.quantity, order.order_number)

    if coupon:
        OrderCoupon.objects.create(order=order, coupon=coupon, discount_amount=discount_total)

    Payment.objects.create(order=order, method=Payment.Method.COD, amount=grand_total)

    cart.delete()

    return order, created_account_password
