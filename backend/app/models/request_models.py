# backend/app/models/request_models.py

from pydantic import BaseModel, Field
from typing import Optional, Literal, List


class CharacterBibleEntry(BaseModel):
    name: str
    role: Optional[str] = None
    appearance: Optional[str] = None
    emotional_state: Optional[str] = None
    notes: Optional[str] = None


class WriteRequest(BaseModel):
    story_id: str
    text: str
    form: Literal["story", "poem", "essay", "dialogue", "children", "experimental"]
    genre: Optional[str] = None


class SuggestionRequest(BaseModel):
    story_id: str
    chapter_id: Optional[str] = None
    text: str
    form: Literal["story", "poem", "essay", "dialogue", "children", "experimental"] = "story"
    genre: Optional[str] = None
    intensity: Literal["gentle", "balanced", "wild"] = "balanced"
    chapter_goal: Optional[str] = None
    emotional_target: Optional[str] = None
    character_bible: List[CharacterBibleEntry] = Field(default_factory=list)
