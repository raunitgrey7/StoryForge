# backend/app/memory/state_updater.py

import re
from app.memory.story_state import StoryState, Character


def infer_tone(text: str) -> str:
    text_lower = text.lower()

    if any(word in text_lower for word in ["blood", "dark", "fear", "shadow"]):
        return "grim"
    if any(word in text_lower for word in ["love", "touch", "heart", "kiss"]):
        return "tender"
    if any(word in text_lower for word in ["run", "chase", "suddenly", "panic"]):
        return "frantic"

    return "neutral"


def infer_tension(text: str) -> str:
    if len(text) < 300:
        return "flat"
    if "but" in text or "however" in text:
        return "rising"
    return "plateau"


def extract_characters(text: str, state: StoryState) -> StoryState:
    # VERY simple name detection (capitalized words)
    names = set(re.findall(r"\b[A-Z][a-z]{2,}\b", text))

    for name in names:
        if name not in state.characters:
            state.characters[name] = Character(name=name)

    return state


def update_story_state(
    previous_state: StoryState | None,
    text: str,
    form: str,
    genre: str | None,
    story_id: str,
) -> StoryState:

    if previous_state is None:
        state = StoryState(
            story_id=story_id,
            form=form,
            genre_primary=genre,
        )
    else:
        state = previous_state

    state.tone = infer_tone(text)
    state.tension = infer_tension(text)
    state = extract_characters(text, state)

    return state
