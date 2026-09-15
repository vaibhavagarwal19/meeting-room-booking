from .bookings import router as bookings_router
from .rooms import router as rooms_router

__all__ = [
    "bookings_router",
    "rooms_router",
]