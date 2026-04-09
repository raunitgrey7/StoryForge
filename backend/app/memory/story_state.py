# backend/app/memory/story_state.py

from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class Character(BaseModel):
    name: str
    role: Optional[str] = None
    appearance: Optional[str] = None
    emotional_state: Optional[str] = None
    secrets: List[str] = Field(default_factory=list)


class StyleMemory(BaseModel):
    tone_preference: Optional[str] = None
    writing_style: Optional[str] = None
    pacing_habit: Optional[str] = None
    writer_level: Optional[str] = None
    writing_modes_seen: List[str] = Field(default_factory=list)


class StoryState(BaseModel):
    story_id: str

    form: str
    genre_primary: Optional[str] = None
    genre_secondary: Optional[str] = None

    tone: Optional[str] = None
    tension: Optional[str] = None  # flat / rising / leaking

    characters: Dict[str, Character] = Field(default_factory=dict)

    unresolved_promises: List[str] = Field(default_factory=list)

    style_memory: StyleMemory = Field(default_factory=StyleMemory)
