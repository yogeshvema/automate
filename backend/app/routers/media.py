from datetime import datetime
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_db
from ..models.destination import Destination
from ..models.send_log import SendLog
from ..schemas.media import UploadResponse
from ..providers.registry import get_provider

router = APIRouter(prefix="/api/v1/media", tags=["media"])


@router.post("/upload", response_model=UploadResponse)
async def upload_and_send(
    file: UploadFile = File(...),
    destination_id: str = Form(...),
    caption: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
):
    # Resolve destination
    result = await db.execute(select(Destination).where(Destination.id == destination_id))
    dest = result.scalar_one_or_none()
    if not dest:
        raise HTTPException(status_code=404, detail="Destination not found")

    file_bytes = await file.read()
    content_type = file.content_type or ""
    media_type = "video" if content_type.startswith("video") else "photo"

    # Persist a pending log entry
    log = SendLog(
        destination_id=dest.id,
        media_type=media_type,
        status="pending",
        file_size_bytes=len(file_bytes),
    )
    db.add(log)
    await db.commit()

    # Dispatch to provider
    provider = get_provider(dest.provider_type, dest.config_json)
    if media_type == "photo":
        send_result = await provider.send_photo(file_bytes, file.filename or "photo.jpg", caption)
    else:
        send_result = await provider.send_video(file_bytes, file.filename or "video.mp4", caption)

    # Update log
    log.status = "sent" if send_result.success else "failed"
    log.error_message = send_result.error
    log.provider_message_id = send_result.message_id
    if send_result.success:
        log.sent_at = datetime.utcnow()
    await db.commit()

    return UploadResponse(
        success=send_result.success,
        message_id=send_result.message_id,
        error=send_result.error,
        media_type=media_type,
        log_id=log.id,
    )
