# backend/app/memory/story_state.py

from typing import Dict, List, Optional
from pydantic import BaseModel


class Character(BaseModel):
    name: str
    role: Optional[str] = None
    emotional_state: Optional[str] = None
    secrets: List[str] = []


class StoryState(BaseModel):
    story_id: str

    form: str
    genre_primary: Optional[str] = None
    genre_secondary: Optional[str] = None

    tone: Optional[str] = None
    tension: Optional[str] = None  # flat / rising / leaking

    characters: Dict[str, Character] = {}

    unresolved_promises: List[str] = []
