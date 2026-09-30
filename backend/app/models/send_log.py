import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from ..database import Base


class SendLog(Base):
    __tablename__ = "send_logs"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    destination_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("destinations.id"), nullable=True
    )
    media_type: Mapped[str] = mapped_column(String(20), nullable=False)  # photo | video
    status: Mapped[str] = mapped_column(String(20), nullable=False)      # pending|sent|failed
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    provider_message_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
