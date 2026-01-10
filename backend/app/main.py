"""FastAPI application entry point."""

from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import close_db, init_db
from app.routers import (
    aftercare_router,
    analytics_router,
    artists_router,
    auth_router,
    availability_router,
    bookings_router,
    client_auth_router,
    commissions_router,
    consent_router,
    messages_router,
    reminders_router,
    studios_router,
    users_router,
    webhooks_router,
)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup/shutdown events."""
    # Startup
    await init_db()
    yield
    # Shutdown
    await close_db()


app = FastAPI(
    title=settings.app_name,
    description="All-in-one SaaS platform for tattoo artists and studios",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(aftercare_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")
app.include_router(artists_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(availability_router, prefix="/api/v1")
app.include_router(bookings_router, prefix="/api/v1")
app.include_router(client_auth_router, prefix="/api/v1")
app.include_router(commissions_router, prefix="/api/v1")
app.include_router(consent_router, prefix="/api/v1")
app.include_router(messages_router, prefix="/api/v1")
app.include_router(reminders_router, prefix="/api/v1")
app.include_router(studios_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(webhooks_router, prefix="/api/v1")

# Static files for uploads (logos, portfolio, references, photo IDs, etc.)
uploads_dir = Path("uploads")
uploads_dir.mkdir(exist_ok=True)
(uploads_dir / "logos").mkdir(exist_ok=True)
(uploads_dir / "portfolio").mkdir(exist_ok=True)
(uploads_dir / "references").mkdir(exist_ok=True)
(uploads_dir / "photo_ids").mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.get("/", tags=["Root"])
async def root() -> dict[str, str]:
    """Root endpoint."""
    return {
        "message": f"Welcome to {settings.app_name} API",
        "docs": "/api/docs",
    }


@app.get("/health", tags=["Health"])
async def health_check() -> dict[str, Any]:
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "app": settings.app_name,
        "version": "0.1.0",
        "environment": settings.app_env,
    }


@app.get("/api/v1/health", tags=["Health"])
async def api_health_check() -> dict[str, Any]:
    """API v1 health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "api_version": "v1",
    }
