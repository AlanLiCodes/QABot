import os
from pathlib import Path

from sqlmodel import SQLModel, Session, create_engine

# DATA_DIR can be overridden via env var — useful for Railway volumes.
# Default: a "data" folder next to this file (apps/api/data/ locally, /app/data/ in Docker).
DATA_DIR = Path(os.getenv("DATA_DIR", str(Path(__file__).resolve().parent / "data")))
DATA_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = f"sqlite:///{DATA_DIR / 'qa_engineer.db'}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


def get_session():
    session = Session(engine)
    try:
        yield session
    finally:
        session.close()
