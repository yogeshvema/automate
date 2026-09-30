import json
from .base import BaseProvider
from .telegram import TelegramProvider


def get_provider(provider_type: str, config_json: str) -> BaseProvider:
    """Return the correct provider instance for the given type + config."""
    config = json.loads(config_json)

    if provider_type == "telegram":
        return TelegramProvider(
            bot_token=config["botToken"],
            chat_id=config["chatId"],
        )

    # Add more providers here:
    # if provider_type == "email": return EmailProvider(...)

    raise ValueError(f"Unknown provider type: {provider_type!r}")
