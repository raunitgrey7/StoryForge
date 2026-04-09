# backend/app/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import os

from app.api import write, story, health
from app.core.config import settings
from app.services.story_repository import init_db

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

app = FastAPI(
    title="StoryForge Backend",
    description="AI co-author backend for StoryForge",
    version="0.1.0",
)

# -----------------------------
# CORS
# -----------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# Static files (CSS / JS / assets)
# -----------------------------
app.mount(
    "/static",
    StaticFiles(directory=FRONTEND_DIR),
    name="static",
)

# -----------------------------
# Routers
# -----------------------------
app.include_router(health.router, prefix="/api")
app.include_router(story.router, prefix="/api/story")
app.include_router(write.router)


@app.on_event("startup")
def on_startup():
    init_db()

# -----------------------------
# Root → index.html
# -----------------------------
@app.get("/", include_in_schema=False)
def serve_index():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
