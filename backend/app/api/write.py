# backend/app/api/write.py

from fastapi import APIRouter
from app.models.request_models import SuggestionRequest
from app.models.response_models import SuggestionResponse
from app.ai.coauthor import generate_suggestions
from app.memory.state_updater import update_story_state
from app.memory.story_state import StoryState
from app.services.suggestion_service import sanitize_suggestions

# TEMP in-memory store
STORY_STORE: dict[str, StoryState] = {}

router = APIRouter(tags=["write"])


@router.post("/suggest", response_model=SuggestionResponse)
def suggest_next(req: SuggestionRequest):

    prev_state = STORY_STORE.get(req.story_id)

    state = update_story_state(
        previous_state=prev_state,
        text=req.text,
        form="story",
        genre=None,
        story_id=req.story_id,
    )

    STORY_STORE[req.story_id] = state

    raw = generate_suggestions(
        text=req.text,
        story_state=state.model_dump(),
    )

    suggestions = sanitize_suggestions(raw)

    return SuggestionResponse(suggestions=suggestions)
