# backend/app/models/request_models.py

from pydantic import BaseModel
from typing import Optional, Literal


class WriteRequest(BaseModel):
    story_id: str
    text: str
    form: Literal["story", "poem", "experimental"]
    genre: Optional[str] = None


class SuggestionRequest(BaseModel):
    story_id: str
    text: str
