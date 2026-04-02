"""
Basic API tests for NeuroVault AI backend.
Run: pytest tests/ -v
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from main import app


@pytest.mark.asyncio
async def test_health():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_register_and_login():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Register
        reg = await client.post("/auth/register", json={
            "email": "test@example.com",
            "full_name": "Test User",
            "password": "testpass123",
        })
        assert reg.status_code == 201
        token = reg.json()["access_token"]

        # Get /me with token
        me = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200
        assert me.json()["email"] == "test@example.com"


@pytest.mark.asyncio
async def test_unauthorized_access():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/documents/")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_documents_list_empty():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Register a fresh user
        reg = await client.post("/auth/register", json={
            "email": "docs@example.com",
            "full_name": "Doc User",
            "password": "pass12345",
        })
        token = reg.json()["access_token"]
        res = await client.get("/documents/", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json() == []
