from pydantic import BaseModel


class UploadResponse(BaseModel):
    success: bool
    message_id: str | None = None
    error: str | None = None
    media_type: str
    log_id: str | None = None
