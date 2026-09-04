from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.rate_limit import limiter

from app.routers.auth import router as auth_router
from app.routers.matters import router as matters_router
from app.routers.onboarding import router as onboarding_router
from app.routers.documents import router as documents_router
from app.routers.payments import router as payments_router
from app.routers.tasks import router as tasks_router
from app.routers.reports import router as reports_router

from sqlalchemy.ext.asyncio import AsyncConnection
from sqlalchemy import text

from app.db import engine, AsyncSessionLocal
from app.seed import seed_if_empty


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name)

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.firm_portal_origin, settings.client_portal_origin],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(matters_router, prefix="/api/v1")
    app.include_router(onboarding_router, prefix="/api/v1")
    app.include_router(documents_router, prefix="/api/v1")
    app.include_router(payments_router, prefix="/api/v1")
    app.include_router(tasks_router, prefix="/api/v1")
    app.include_router(reports_router, prefix="/api/v1")

    @app.get("/health")
    async def health():
        async with engine.connect() as conn:  # type: AsyncConnection
            await conn.execute(text("SELECT 1"))
        return {"ok": True}

    @app.on_event("startup")
    async def startup():
        # In tests we skip migrations/seed for speed and isolation
        if settings.app_env == "test":
            return

        async with AsyncSessionLocal() as db:
            await seed_if_empty(db)

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
