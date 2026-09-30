import httpx
from .base import BaseProvider, SendResult

TELEGRAM_BASE = "https://api.telegram.org"


class TelegramProvider(BaseProvider):
    def __init__(self, bot_token: str, chat_id: str) -> None:
        self.bot_token = bot_token
        self.chat_id = chat_id
        self._api = f"{TELEGRAM_BASE}/bot{bot_token}"

    async def send_photo(
        self,
        file_bytes: bytes,
        filename: str,
        caption: str | None = None,
    ) -> SendResult:
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                data: dict = {"chat_id": self.chat_id}
                if caption:
                    data["caption"] = caption
                files = {"photo": (filename, file_bytes, "image/jpeg")}
                resp = await client.post(f"{self._api}/sendPhoto", data=data, files=files)
                resp.raise_for_status()
                body = resp.json()
                if not body.get("ok"):
                    return SendResult(success=False, error=body.get("description", "Telegram error"))
                return SendResult(success=True, message_id=str(body["result"]["message_id"]))
            except httpx.HTTPError as exc:
                return SendResult(success=False, error=str(exc))

    async def send_video(
        self,
        file_bytes: bytes,
        filename: str,
        caption: str | None = None,
    ) -> SendResult:
        async with httpx.AsyncClient(timeout=300.0) as client:
            try:
                data: dict = {"chat_id": self.chat_id, "supports_streaming": "true"}
                if caption:
                    data["caption"] = caption
                files = {"video": (filename, file_bytes, "video/mp4")}
                resp = await client.post(f"{self._api}/sendVideo", data=data, files=files)
                resp.raise_for_status()
                body = resp.json()
                if not body.get("ok"):
                    return SendResult(success=False, error=body.get("description", "Telegram error"))
                return SendResult(success=True, message_id=str(body["result"]["message_id"]))
            except httpx.HTTPError as exc:
                return SendResult(success=False, error=str(exc))

    async def test_connection(self) -> dict:
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                resp = await client.get(f"{self._api}/getMe")
                resp.raise_for_status()
                body = resp.json()
                if body.get("ok"):
                    bot = body["result"]
                    return {
                        "ok": True,
                        "bot_name": bot.get("first_name"),
                        "bot_username": bot.get("username"),
                    }
                return {"ok": False, "error": body.get("description", "Unknown")}
            except Exception as exc:
                return {"ok": False, "error": str(exc)}
