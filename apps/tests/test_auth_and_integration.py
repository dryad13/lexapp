import os

# Set env BEFORE importing app modules
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("APP_NAME", "Test")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test.db")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("STRIPE_SECRET_KEY", "sk_test_dummy")
os.environ.setdefault("STRIPE_PUBLISHABLE_KEY", "pk_test_dummy")
os.environ.setdefault("STRIPE_WEBHOOK_SECRET", "whsec_dummy")
os.environ.setdefault("FIRM_PORTAL_ORIGIN", "http://localhost:3000")
os.environ.setdefault("CLIENT_PORTAL_ORIGIN", "http://localhost:3002")

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


def test_openapi_exists():
    app = create_app()
    client = TestClient(app)
    r = client.get("/openapi.json")
    assert r.status_code == 200
    assert "paths" in r.json()


def test_rate_limited_login_endpoint_exists():
    app = create_app()
    client = TestClient(app)
    # We expect 401 because test DB is empty (startup seed is skipped in test mode)
    r = client.post("/api/v1/auth/login", json={"email":"x@example.com","password":"Password123!"})
    assert r.status_code in (401, 422)
