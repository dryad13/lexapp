from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

AUTH_LIMIT = "10/minute"
ONBOARD_LIMIT = "30/minute"
