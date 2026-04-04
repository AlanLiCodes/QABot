import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

load_dotenv(Path(__file__).resolve().parent / ".env")

import models.db_models  # noqa: F401 — register tables
from database import ROOT, init_db
from routers import runs, tests

ARTIFACTS_DIR = ROOT / "artifacts"
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="AI QA Engineer API", version="0.1.0")

origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tests.router)
app.include_router(runs.router)
app.mount("/files", StaticFiles(directory=str(ARTIFACTS_DIR)), name="files")


@app.on_event("startup")
def on_startup():
    init_db()
    _log_key_status()


def _log_key_status() -> None:
    import logging
    log = logging.getLogger("uvicorn.error")

    google_key = bool((os.getenv("GOOGLE_API_KEY") or "").strip())
    bu_key     = bool((os.getenv("BROWSER_USE_API_KEY") or "").strip())

    if google_key:
        log.info("QABot: GOOGLE_API_KEY configured — Gemini planner, validator, and /discuss are active")
    else:
        log.warning(
            "QABot: GOOGLE_API_KEY is NOT SET.\n"
            "  Effect: test-case generation uses fallback templates; validation uses heuristics;\n"
            "          /discuss returns 503; chat Q&A is unavailable.\n"
            "  Fix   : add GOOGLE_API_KEY=<your_key> to apps/api/.env and restart."
        )

    if bu_key:
        log.info("QABot: BROWSER_USE_API_KEY configured — Browser Use Cloud agent active")
    else:
        log.warning(
            "QABot: BROWSER_USE_API_KEY is NOT SET.\n"
            "  Effect: Browser Use Cloud agent unavailable; runs use Playwright smoke tests only.\n"
            "  Fix   : add BROWSER_USE_API_KEY=<your_key> to apps/api/.env and restart."
        )


@app.get("/health")
def health():
    return {"status": "ok"}
