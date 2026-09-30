from pydantic import BaseModel
from datetime import datetime
from typing import Any


class DestinationCreate(BaseModel):
    name: str
    provider_type: str
    config: dict[str, Any]
    is_default: bool = False


class DestinationUpdate(BaseModel):
    name: str | None = None
    config: dict[str, Any] | None = None
    is_default: bool | None = None


class DestinationResponse(BaseModel):
    id: str
    name: str
    provider_type: str
    is_default: bool
    created_at: datetime

    model_config = {"from_attributes": True}
