from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class SendResult:
    success: bool
    message_id: str | None = None
    error: str | None = None


class BaseProvider(ABC):
    """Abstract base for all messaging providers."""

    @abstractmethod
    async def send_photo(
        self,
        file_bytes: bytes,
        filename: str,
        caption: str | None = None,
    ) -> SendResult: ...

    @abstractmethod
    async def send_video(
        self,
        file_bytes: bytes,
        filename: str,
        caption: str | None = None,
    ) -> SendResult: ...

    @abstractmethod
    async def test_connection(self) -> dict: ...
