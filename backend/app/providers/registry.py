import json
from .base import BaseProvider
from .telegram import TelegramProvider


def get_provider(provider_type: str, config_json: str) -> BaseProvider:
    config = json.loads(config_json)

    if provider_type == "telegram":
        return TelegramProvider(
            bot_token=config["botToken"],
            chat_id=config["chatId"],
        )

    raise ValueError(f"Unknown provider type: {provider_type!r}")
