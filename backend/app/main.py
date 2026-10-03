import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import init_db
from .routers import health, destinations, media

settings = get_settings()

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="[%(asctime)s] [%(levelname)s] [%(name)s]: %(message)s",
)
logger = logging.getLogger("snapsend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up SnapSend API (environment=%s)...", settings.environment)
    await init_db()
    logger.info("Database initialized successfully.")
    yield
    logger.info("Shutting down SnapSend API.")


app = FastAPI(
    title="SnapSend API",
    description="Capture-and-send media relay API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(destinations.router)
app.include_router(media.router)

