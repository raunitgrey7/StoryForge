# backend/app/models/response_models.py

from pydantic import BaseModel
from typing import List, Literal


class StoryPath(BaseModel):
    type: Literal["twist", "escalation", "emotional", "genre_shift"]
    description: str
    storyline: str
    impact: str
    risk: str


class CastProfile(BaseModel):
    name: str
    role: str
    appearance: str
    emotional_state: str


class NarrativeSuggestionResponse(BaseModel):
    simple_suggestion: str
    creative_suggestion: str
    bold_suggestion: str
    paths: List[StoryPath]
    twists: List[str]
    character_ideas: List[str]
    cast_names: List[str]
    cast_profiles: List[CastProfile]
    genre_applied: str
    writing_mode: str
    writer_level: Literal["beginner", "intermediate", "advanced"]
    chapter_compass: str
    continuity_alerts: List[str]
    continuity_score: int
    reasoning: str
