from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail


@shared_task
def send_welcome_email(user_id):
    from .models import User

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return

    send_mail(
        subject="Welcome to Shordindu",
        message=f"Hi {user.name},\n\nYour account ({user.email}) has been created.",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
    )


@shared_task
def send_account_created_email(user_id, plain_password):
    from .models import User

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return

    send_mail(
        subject="Your Shordindu account has been created",
        message=(
            f"Hi {user.name},\n\n"
            "An account was created for you automatically during checkout.\n\n"
            f"Email: {user.email}\n"
            f"Temporary password: {plain_password}\n\n"
            "Please log in and change your password as soon as possible."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
    )
