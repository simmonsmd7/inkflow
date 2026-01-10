"""API routers package."""

from app.routers.auth import router as auth_router
from app.routers.studios import router as studios_router
from app.routers.users import router as users_router

__all__ = ["auth_router", "studios_router", "users_router"]
