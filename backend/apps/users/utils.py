import secrets


def generate_secure_password(nbytes: int = 16) -> str:
    return secrets.token_urlsafe(nbytes)
