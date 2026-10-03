from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "SnapSend API"
    debug: bool = False
    environment: str = "production"
    log_level: str = "INFO"
    database_url: str = "sqlite+aiosqlite:///./snapsend.db"
    secret_key: str = "changeme"

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
