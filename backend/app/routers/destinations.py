import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_db
from ..models.destination import Destination
from ..schemas.destination import DestinationCreate, DestinationUpdate, DestinationResponse
from ..providers.registry import get_provider

router = APIRouter(prefix="/api/v1/destinations", tags=["destinations"])


@router.get("", response_model=list[DestinationResponse])
async def list_destinations(db: AsyncSession = Depends(get_db)):
    rows = await db.execute(select(Destination))
    return rows.scalars().all()


@router.post("", response_model=DestinationResponse, status_code=201)
async def create_destination(body: DestinationCreate, db: AsyncSession = Depends(get_db)):
    dest = Destination(
        name=body.name,
        provider_type=body.provider_type,
        config_json=json.dumps(body.config),
        is_default=body.is_default,
    )
    db.add(dest)
    await db.commit()
    await db.refresh(dest)
    return dest


@router.put("/{dest_id}", response_model=DestinationResponse)
async def update_destination(
    dest_id: str, body: DestinationUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Destination).where(Destination.id == dest_id))
    dest = result.scalar_one_or_none()
    if not dest:
        raise HTTPException(status_code=404, detail="Destination not found")
    if body.name is not None:
        dest.name = body.name
    if body.config is not None:
        dest.config_json = json.dumps(body.config)
    if body.is_default is not None:
        dest.is_default = body.is_default
    await db.commit()
    await db.refresh(dest)
    return dest


@router.delete("/{dest_id}")
async def delete_destination(dest_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Destination).where(Destination.id == dest_id))
    dest = result.scalar_one_or_none()
    if not dest:
        raise HTTPException(status_code=404, detail="Destination not found")
    await db.delete(dest)
    await db.commit()
    return {"ok": True}


@router.post("/{dest_id}/test")
async def test_destination(dest_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Destination).where(Destination.id == dest_id))
    dest = result.scalar_one_or_none()
    if not dest:
        raise HTTPException(status_code=404, detail="Destination not found")
    provider = get_provider(dest.provider_type, dest.config_json)
    return await provider.test_connection()
