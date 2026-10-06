import pytest
import pytest_asyncio
import httpx
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.database import Base, get_db

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestingSessionLocal = async_sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)


async def override_get_db():
    async with TestingSessionLocal() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.mark.asyncio
async def test_destinations_crud():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/destinations")
        assert res.status_code == 200
        initial_list = res.json()
        assert isinstance(initial_list, list)

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

        res_update = await client.put(
            f"/api/v1/destinations/{dest_id}",
            json={"name": "Updated Telegram Bot"},
        )
        assert res_update.status_code == 200
        assert res_update.json()["name"] == "Updated Telegram Bot"

        res_del = await client.delete(f"/api/v1/destinations/{dest_id}")
        assert res_del.status_code == 200
        assert res_del.json() == {"ok": True}

        res_del_again = await client.delete(f"/api/v1/destinations/{dest_id}")
        assert res_del_again.status_code == 404
