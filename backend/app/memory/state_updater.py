# backend/app/memory/state_updater.py

import re
from app.memory.story_state import StoryState, Character
from app.services.intent_service import detect_pacing_habit, infer_writing_style


ROLE_CUES = {
    "vampire": "vampire",
    "werewolf": "werewolf",
    "hunter": "hunter",
    "detective": "detective",
    "professor": "professor",
    "captain": "captain",
    "witch": "witch",
    "king": "royalty",
    "queen": "royalty",
}

LOOK_CUES = [
    "tall", "short", "scarred", "pale", "golden-eyed", "blue-eyed",
    "green-eyed", "silver-haired", "dark-haired", "curly-haired", "lean",
    "broad-shouldered", "tattooed", "freckled", "hooded", "elegant",
    "ragged", "armored", "graceful", "weathered",
]

EMOTION_CUES = [
    "afraid", "angry", "furious", "worried", "hopeful", "grief", "shaken",
    "confident", "calm", "desperate", "jealous", "tender", "cold",
]


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


def _find_context_sentence(text: str, name: str) -> str:
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
    for sentence in sentences:
        if re.search(rf"\b{re.escape(name)}\b", sentence):
            return sentence
    return ""


def _infer_role(context: str) -> str | None:
    lowered = context.lower()
    for cue, role in ROLE_CUES.items():
        if cue in lowered:
            return role
    return None


def _infer_appearance(context: str) -> str | None:
    lowered = context.lower()
    found = [cue for cue in LOOK_CUES if cue in lowered]
    if not found:
        return None
    pretty = ", ".join(found[:3])
    return f"Noted look cues: {pretty}."


def _infer_emotional_state(context: str) -> str | None:
    lowered = context.lower()
    for cue in EMOTION_CUES:
        if cue in lowered:
            return cue
    return None


def extract_characters(text: str, state: StoryState) -> StoryState:
    # VERY simple name detection (capitalized words)
    raw_names = set(re.findall(r"\b[A-Z][a-z]{2,}\b", text))
    stop_words = {
        "The", "And", "But", "When", "Then", "That", "With", "From", "Into",
        "This", "There", "Night", "Day", "City", "Street", "House", "Forest",
    }
    names = {name for name in raw_names if name not in stop_words}

    for name in names:
        context = _find_context_sentence(text, name)
        role = _infer_role(context)
        appearance = _infer_appearance(context)
        emotional_state = _infer_emotional_state(context)

        if name not in state.characters:
            state.characters[name] = Character(
                name=name,
                role=role,
                appearance=appearance,
                emotional_state=emotional_state,
            )
            continue

        character = state.characters[name]
        if role and not character.role:
            character.role = role
        if appearance and not character.appearance:
            character.appearance = appearance
        if emotional_state:
            character.emotional_state = emotional_state

    return state


def update_story_state(
    previous_state: StoryState | None,
    text: str,
    form: str,
    genre: str | None,
    story_id: str,
    writer_level: str | None = None,
    writing_mode: str | None = None,
    character_bible: list[dict] | None = None,
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

    # User-defined character bible entries override inferred fields when supplied.
    for entry in character_bible or []:
        name = str(entry.get("name", "")).strip()
        if not name:
            continue

        if name not in state.characters:
            state.characters[name] = Character(name=name)

        character = state.characters[name]
        for field_name in ["role", "appearance", "emotional_state"]:
            value = entry.get(field_name)
            if isinstance(value, str) and value.strip():
                setattr(character, field_name, value.strip())

    # Personalization memory tracks recurring style choices over time.
    state.style_memory.tone_preference = state.tone
    state.style_memory.pacing_habit = detect_pacing_habit(text)
    state.style_memory.writing_style = infer_writing_style(text, writing_mode or form)
    if writer_level:
        state.style_memory.writer_level = writer_level
    if writing_mode:
        seen = set(state.style_memory.writing_modes_seen)
        if writing_mode not in seen:
            state.style_memory.writing_modes_seen.append(writing_mode)

    return state
