from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "SnapSend API"
    debug: bool = False
    database_url: str = "sqlite+aiosqlite:///./snapsend.db"
    secret_key: str = "changeme"

    model_config = {"env_file": ".env"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
