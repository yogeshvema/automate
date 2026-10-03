from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_db
from ..config import get_settings

router = APIRouter(tags=["health"])
settings = get_settings()
START_TIME = datetime.now(timezone.utc)


@router.get("/health")
async def health(db: AsyncSession = Depends(get_db)) -> dict:
    db_status = "ok"
    try:
        await db.execute(text("SELECT 1"))
    except Exception as exc:
        db_status = f"unhealthy: {str(exc)}"

    now = datetime.now(timezone.utc)
    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "service": settings.app_name,
        "environment": settings.environment,
        "database": db_status,
        "uptime_seconds": round((now - START_TIME).total_seconds()),
        "timestamp": now.isoformat(),
    }
