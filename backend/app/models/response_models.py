# backend/app/models/response_models.py

from pydantic import BaseModel
from typing import List


class Suggestion(BaseModel):
    type: str   # Pressure, Depth, Direction, Atmosphere, Silence
    content: str


class SuggestionResponse(BaseModel):
    suggestions: List[Suggestion]
