"""API routers package."""

from app.routers.aftercare import router as aftercare_router
from app.routers.analytics import router as analytics_router
from app.routers.artists import router as artists_router
from app.routers.auth import router as auth_router
from app.routers.availability import router as availability_router
from app.routers.bookings import router as bookings_router
from app.routers.commissions import router as commissions_router
from app.routers.consent import router as consent_router
from app.routers.messages import router as messages_router
from app.routers.reminders import router as reminders_router
from app.routers.studios import router as studios_router
from app.routers.users import router as users_router
from app.routers.webhooks import router as webhooks_router

__all__ = [
    "aftercare_router",
    "analytics_router",
    "artists_router",
    "auth_router",
    "availability_router",
    "bookings_router",
    "commissions_router",
    "consent_router",
    "messages_router",
    "reminders_router",
    "studios_router",
    "users_router",
    "webhooks_router",
]
