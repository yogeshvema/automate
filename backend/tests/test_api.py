import pytest
import pytest_asyncio
import httpx
from app.main import app
from app.database import init_db


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    await init_db()
    yield


@pytest.mark.asyncio
async def test_health_endpoint():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "SnapSend API"
        assert data["database"] == "ok"
        assert "uptime_seconds" in data


@pytest.mark.asyncio
async def test_destinations_crud():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. List initially
        res = await client.get("/api/v1/destinations")
        assert res.status_code == 200
        initial_list = res.json()
        assert isinstance(initial_list, list)

        # 2. Create destination
        payload = {
            "name": "Test Telegram Bot",
            "provider_type": "telegram",
            "config": {"bot_token": "123456:ABC-DEF", "chat_id": "-100123456789"},
            "is_default": True,
        }
        res_create = await client.post("/api/v1/destinations", json=payload)
        assert res_create.status_code == 201
        created = res_create.json()
        assert created["name"] == "Test Telegram Bot"
        dest_id = created["id"]

        # 3. Update destination
        res_update = await client.put(
            f"/api/v1/destinations/{dest_id}",
            json={"name": "Updated Telegram Bot"},
        )
        assert res_update.status_code == 200
        assert res_update.json()["name"] == "Updated Telegram Bot"

        # 4. Delete destination
        res_del = await client.delete(f"/api/v1/destinations/{dest_id}")
        assert res_del.status_code == 200
        assert res_del.json() == {"ok": True}

        # 5. Verify deleted
        res_del_again = await client.delete(f"/api/v1/destinations/{dest_id}")
        assert res_del_again.status_code == 404
