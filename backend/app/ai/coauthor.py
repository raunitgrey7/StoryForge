from app.ai.engine import generate_narrative_suggestions


def generate_suggestions(text: str, story_state: dict) -> dict:
    return generate_narrative_suggestions(
        text=text,
        story_state=story_state,
        writing_mode="story",
        writer_level="intermediate",
        intensity="balanced",
    )
