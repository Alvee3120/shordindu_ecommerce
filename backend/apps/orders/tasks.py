from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail


@shared_task
def send_order_confirmation_email(order_id):
    from .models import Order

    try:
        order = Order.objects.select_related("user").get(id=order_id)
    except Order.DoesNotExist:
        return

    email = order.user.email if order.user else order.guest_email
    if not email:
        return

    send_mail(
        subject=f"Order confirmation - {order.order_number}",
        message=(
            f"Thanks for your order!\n\n"
            f"Order number: {order.order_number}\n"
            f"Grand total: {order.grand_total} BDT\n"
            f"Payment method: Cash on Delivery\n"
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
    )
