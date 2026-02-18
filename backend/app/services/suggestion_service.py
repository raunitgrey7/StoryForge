# backend/app/services/suggestion_service.py

from app.models.response_models import Suggestion

ALLOWED_TYPES = {
    "Pressure",
    "Depth",
    "Direction",
    "Atmosphere",
    "Silence",
}


def sanitize_suggestions(raw: dict) -> list[Suggestion]:
    suggestions = []

    for item in raw.get("suggestions", []):
        s_type = item.get("type")
        content = item.get("content")

        if not s_type or not content:
            continue

        if s_type not in ALLOWED_TYPES:
            continue

        suggestions.append(
            Suggestion(
                type=s_type,
                content=content.strip()
            )
        )

    if not suggestions:
        suggestions.append(
            Suggestion(
                type="Silence",
                content="Let this moment breathe before changing it."
            )
        )

    return suggestions[:3]
