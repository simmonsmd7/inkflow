"""API routers package."""

from app.routers.artists import router as artists_router
from app.routers.auth import router as auth_router
from app.routers.availability import router as availability_router
from app.routers.bookings import router as bookings_router
from app.routers.studios import router as studios_router
from app.routers.users import router as users_router

__all__ = [
    "artists_router",
    "auth_router",
    "availability_router",
    "bookings_router",
    "studios_router",
    "users_router",
]
