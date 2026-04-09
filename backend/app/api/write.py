# backend/app/api/write.py

from fastapi import APIRouter
from app.models.request_models import SuggestionRequest
from app.models.response_models import NarrativeSuggestionResponse
from app.ai.engine import generate_narrative_suggestions
from app.memory.state_updater import update_story_state
from app.memory.story_state import StoryState
from app.services.intent_service import detect_writing_mode, detect_writer_level

# TEMP in-memory store
STORY_STORE: dict[str, StoryState] = {}

router = APIRouter(tags=["write"])


@router.post("/suggest", response_model=NarrativeSuggestionResponse)
def suggest_next(req: SuggestionRequest):
    state_key = req.story_id if not req.chapter_id else f"{req.story_id}:{req.chapter_id}"
    prev_state = STORY_STORE.get(state_key)

    writing_mode = detect_writing_mode(req.text, preferred_mode=req.form)
    writer_level = detect_writer_level(req.text)

    state = update_story_state(
        previous_state=prev_state,
        text=req.text,
        form=writing_mode,
        genre=req.genre,
        story_id=req.story_id,
        writer_level=writer_level,
        writing_mode=writing_mode,
        character_bible=[item.model_dump() for item in req.character_bible],
    )

    STORY_STORE[state_key] = state

    result = generate_narrative_suggestions(
        text=req.text,
        story_state=state.model_dump(),
        writing_mode=writing_mode,
        writer_level=writer_level,
        intensity=req.intensity,
        genre_target=req.genre,
        chapter_goal=req.chapter_goal,
        emotional_target=req.emotional_target,
        character_bible=[item.model_dump() for item in req.character_bible],
    )

    return NarrativeSuggestionResponse(**result)
