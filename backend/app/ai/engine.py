import json
import re
from typing import Any

from app.ai.model_router import get_rotating_client_and_model
from app.ai.prompts import (
    CURATION_PROMPT,
    POSSIBILITY_ENGINE_PROMPT,
    STORY_UNDERSTANDING_PROMPT,
)


DEFAULT_UNDERSTANDING = {
    "tone": "neutral",
    "genre_guess": "unspecified",
    "tension_level": "medium",
    "character_signals": [],
    "narrative_direction": "The scene is developing and open to multiple continuations.",
    "risks": ["Insufficient signal for deep interpretation."],
    "focus_recommendation": "Keep the next move clear and emotionally grounded.",
}

DEFAULT_POSSIBILITIES = {
    "paths": [
        {
            "type": "emotional",
            "description": "Let a character reveal an internal conflict that reframes the scene.",
            "storyline": "As the night deepens, one protector confesses he once made a pact with a vampire elder to save his sibling. The confession fractures trust in the werewolf group. Before anyone can respond, a distant church bell rings three times, signaling that the pact may still be active.",
            "impact": "Deepens reader investment without forcing plot acceleration.",
            "risk": "Could slow pacing if overextended.",
        },
        {
            "type": "escalation",
            "description": "Introduce a new pressure that raises stakes in the next beat.",
            "storyline": "A body is found at the border between vampire and werewolf territory with both symbols carved nearby, forcing each side to suspect betrayal. Patrols collide in the streets and curfew sirens begin to sound. The protagonist must choose whether to reveal a clue that could stop war but expose a dangerous secret.",
            "impact": "Creates forward momentum and urgency.",
            "risk": "May feel abrupt if not grounded in existing context.",
        },
    ],
    "twists": ["A hidden motive surfaces and changes how the current conflict is interpreted."],
    "character_ideas": ["A secondary character gains agency and complicates the protagonist's choice."],
}

DEFAULT_CURATION = {
    "selected_paths": DEFAULT_POSSIBILITIES["paths"][:2],
    "reasoning": "These paths are specific, high-impact, and preserve authorial control.",
    "simple_suggestion": "Pick one clear next event and write it in plain language.",
    "creative_suggestion": "Use contrast: pair a quiet emotional beat with a rising external pressure.",
    "bold_suggestion": "Reveal a truth that changes what the scene means, but keep character motives consistent.",
    "rejected_ideas": [],
}


def _extract_json_block(text: str) -> str | None:
    if not text:
        return None

    stripped = text.strip()
    if stripped.startswith("{") and stripped.endswith("}"):
        return stripped

    match = re.search(r"\{[\s\S]*\}", stripped)
    if not match:
        return None
    return match.group(0)


def _safe_parse_json(text: str, fallback: dict[str, Any]) -> dict[str, Any]:
    json_block = _extract_json_block(text)
    if not json_block:
        return fallback

    try:
        parsed = json.loads(json_block)
        if isinstance(parsed, dict):
            return parsed
        return fallback
    except Exception:
        return fallback


def _run_layer(prompt: str, payload: dict[str, Any], fallback: dict[str, Any]) -> dict[str, Any]:
    layer_prompt = f"""
{prompt}

INPUT JSON:
{json.dumps(payload, ensure_ascii=True)}
"""

    try:
        client, model_name = get_rotating_client_and_model()
        response = client.models.generate_content(
            model=model_name,
            contents=layer_prompt,
        )
        text = getattr(response, "text", "") or ""
        return _safe_parse_json(text, fallback)
    except Exception:
        return fallback


def _normalize_path(path: dict[str, Any]) -> dict[str, str] | None:
    p_type = str(path.get("type", "")).strip().lower().replace(" ", "_")
    if p_type not in {"twist", "escalation", "emotional", "genre_shift"}:
        return None

    description = str(path.get("description", "")).strip()
    storyline = str(path.get("storyline", "")).strip()
    impact = str(path.get("impact", "")).strip()
    risk = str(path.get("risk", "")).strip()

    if not description or not impact or not risk:
        return None
    if not storyline:
        storyline = f"Next, {description[0].lower() + description[1:]}"

    return {
        "type": p_type,
        "description": description,
        "storyline": storyline,
        "impact": impact,
        "risk": risk,
    }


def _normalize_paths(paths: Any) -> list[dict[str, str]]:
    if not isinstance(paths, list):
        return []

    normalized: list[dict[str, str]] = []
    seen = set()

    for item in paths:
        if not isinstance(item, dict):
            continue
        parsed = _normalize_path(item)
        if not parsed:
            continue

        fingerprint = (
            parsed["type"],
            parsed["description"].lower(),
            parsed["storyline"].lower(),
            parsed["impact"].lower(),
            parsed["risk"].lower(),
        )
        if fingerprint in seen:
            continue

        seen.add(fingerprint)
        normalized.append(parsed)

    return normalized


def _normalize_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []

    normalized: list[str] = []
    seen = set()
    for item in value:
        text = str(item).strip()
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        normalized.append(text)
    return normalized


def _extract_cast_names(story_state: dict[str, Any]) -> list[str]:
    characters = story_state.get("characters", {})
    if not isinstance(characters, dict):
        return []

    names = []
    seen = set()
    for name in characters.keys():
        parsed = str(name).strip()
        if not parsed:
            continue
        key = parsed.lower()
        if key in seen:
            continue
        seen.add(key)
        names.append(parsed)
    return names[:6]


def _extract_cast_profiles(story_state: dict[str, Any]) -> list[dict[str, str]]:
    characters = story_state.get("characters", {})
    if not isinstance(characters, dict):
        return []

    profiles = []
    for name, details in characters.items():
        data = details if isinstance(details, dict) else {}
        parsed_name = str(name).strip()
        if not parsed_name:
            continue

        profiles.append(
            {
                "name": parsed_name,
                "role": str(data.get("role") or "unspecified"),
                "appearance": str(data.get("appearance") or "Not visually described yet."),
                "emotional_state": str(data.get("emotional_state") or "undisclosed"),
            }
        )

    profiles.sort(key=lambda p: p["name"].lower())
    return profiles[:6]


def _contains_any(text: str, values: list[str]) -> bool:
    lowered = text.lower()
    return any(v.lower() in lowered for v in values if v)


def _contextualize_paths(
    paths: list[dict[str, str]],
    cast_names: list[str],
    genre_target: str,
    twists: list[str],
) -> list[dict[str, str]]:
    enriched = []
    for idx, path in enumerate(paths):
        storyline = path["storyline"].strip()

        if cast_names and not _contains_any(storyline, cast_names):
            lead = cast_names[idx % len(cast_names)]
            storyline = f"{lead} takes the lead in this beat. {storyline}"

        if genre_target and genre_target != "keep" and genre_target.lower() not in storyline.lower():
            storyline = f"{storyline} The scene leans into {genre_target} elements."

        if twists and idx == 0 and twists[0].lower() not in storyline.lower():
            storyline = f"{storyline} Twist cue: {twists[0]}"

        updated = dict(path)
        updated["storyline"] = storyline
        enriched.append(updated)

    return enriched


def _contextualize_suggestion(
    text: str,
    cast_names: list[str],
    genre_target: str,
    twists: list[str],
) -> str:
    enriched = text.strip()
    if cast_names and not _contains_any(enriched, cast_names):
        enriched = f"{enriched} Let {cast_names[0]} drive the next move."
    if genre_target and genre_target != "keep" and genre_target.lower() not in enriched.lower():
        enriched = f"{enriched} Shape it with a {genre_target} tone."
    if twists and twists[0].lower() not in enriched.lower():
        enriched = f"{enriched} Keep this twist in play: {twists[0]}"
    return enriched


def _build_chapter_compass(
    chapter_goal: str | None,
    emotional_target: str | None,
    selected_paths: list[dict[str, str]],
) -> str:
    goal = (chapter_goal or "").strip()
    emotion = (emotional_target or "").strip()
    if not goal and not emotion:
        return "No chapter goal set yet. Define a chapter objective to tighten future path curation."

    lead = selected_paths[0]["description"] if selected_paths else "advance a meaningful beat"
    fragments = []
    if goal:
        fragments.append(f"Goal: {goal}")
    if emotion:
        fragments.append(f"Emotional target: {emotion}")
    fragments.append(f"Best next move: {lead}")
    return " | ".join(fragments)


def _continuity_guard(
    text: str,
    cast_profiles: list[dict[str, str]],
    twists: list[str],
    genre_target: str,
) -> tuple[list[str], int]:
    alerts: list[str] = []
    text_lower = text.lower()

    for profile in cast_profiles:
        name = profile.get("name", "")
        role = (profile.get("role") or "").strip().lower()
        if not name:
            continue
        if name.lower() in text_lower and role and role not in text_lower:
            alerts.append(f"{name} appears without role reference ({role}); confirm identity continuity.")

    if genre_target and genre_target != "keep" and genre_target.lower() not in text_lower:
        alerts.append(f"Current draft has limited explicit {genre_target} signals; reinforce genre tone in next beat.")

    if twists and twists[0].lower() not in text_lower:
        alerts.append("Primary twist is not reflected in current draft; consider seeding it earlier.")

    if not alerts:
        alerts.append("Continuity looks stable across cast, genre, and twist anchors.")

    score = max(40, 100 - (len([a for a in alerts if "stable" not in a.lower()]) * 15))
    return alerts[:4], score


def generate_narrative_suggestions(
    text: str,
    story_state: dict[str, Any],
    writing_mode: str,
    writer_level: str,
    intensity: str,
    genre_target: str | None = None,
    chapter_goal: str | None = None,
    emotional_target: str | None = None,
    character_bible: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    normalized_genre = (genre_target or "keep").strip() or "keep"
    cast_names = _extract_cast_names(story_state)
    cast_profiles = _extract_cast_profiles(story_state)

    understanding_payload = {
        "text": text,
        "story_state": story_state,
        "writing_mode": writing_mode,
        "writer_level": writer_level,
        "intensity": intensity,
        "genre_target": normalized_genre,
        "cast_names": cast_names,
        "chapter_goal": chapter_goal,
        "emotional_target": emotional_target,
        "character_bible": character_bible or [],
        "style_memory": story_state.get("style_memory", {}),
    }
    understanding = _run_layer(
        prompt=STORY_UNDERSTANDING_PROMPT,
        payload=understanding_payload,
        fallback=DEFAULT_UNDERSTANDING,
    )

    possibility_payload = {
        "text": text,
        "story_state": story_state,
        "writing_mode": writing_mode,
        "writer_level": writer_level,
        "intensity": intensity,
        "genre_target": normalized_genre,
        "cast_names": cast_names,
        "chapter_goal": chapter_goal,
        "emotional_target": emotional_target,
        "character_bible": character_bible or [],
        "style_memory": story_state.get("style_memory", {}),
        "understanding": understanding,
    }
    possibilities = _run_layer(
        prompt=POSSIBILITY_ENGINE_PROMPT,
        payload=possibility_payload,
        fallback=DEFAULT_POSSIBILITIES,
    )

    normalized_paths = _normalize_paths(possibilities.get("paths", []))
    if not normalized_paths:
        normalized_paths = DEFAULT_POSSIBILITIES["paths"]

    twists = _normalize_string_list(possibilities.get("twists", []))
    character_ideas = _normalize_string_list(possibilities.get("character_ideas", []))

    curation_payload = {
        "text": text,
        "writing_mode": writing_mode,
        "writer_level": writer_level,
        "intensity": intensity,
        "genre_target": normalized_genre,
        "cast_names": cast_names,
        "chapter_goal": chapter_goal,
        "emotional_target": emotional_target,
        "character_bible": character_bible or [],
        "style_memory": story_state.get("style_memory", {}),
        "understanding": understanding,
        "candidate_paths": normalized_paths,
        "twists": twists,
        "character_ideas": character_ideas,
    }
    curation = _run_layer(
        prompt=CURATION_PROMPT,
        payload=curation_payload,
        fallback=DEFAULT_CURATION,
    )

    selected_paths = _normalize_paths(curation.get("selected_paths", []))
    if len(selected_paths) < 2:
        selected_paths = normalized_paths[:2]

    reasoning = str(curation.get("reasoning", "")).strip()
    if not reasoning:
        reasoning = "Selected for distinctiveness, narrative leverage, and fit with the current direction."

    simple_suggestion = str(curation.get("simple_suggestion", "")).strip() or DEFAULT_CURATION["simple_suggestion"]
    creative_suggestion = str(curation.get("creative_suggestion", "")).strip() or DEFAULT_CURATION["creative_suggestion"]
    bold_suggestion = str(curation.get("bold_suggestion", "")).strip() or DEFAULT_CURATION["bold_suggestion"]

    curated_paths = selected_paths + [p for p in normalized_paths if p not in selected_paths]
    enriched_paths = _contextualize_paths(curated_paths[:3], cast_names, normalized_genre, twists)
    simple_suggestion = _contextualize_suggestion(simple_suggestion, cast_names, normalized_genre, twists)
    creative_suggestion = _contextualize_suggestion(creative_suggestion, cast_names, normalized_genre, twists)
    bold_suggestion = _contextualize_suggestion(bold_suggestion, cast_names, normalized_genre, twists)
    chapter_compass = _build_chapter_compass(chapter_goal, emotional_target, enriched_paths)
    continuity_alerts, continuity_score = _continuity_guard(
        text=text,
        cast_profiles=cast_profiles,
        twists=twists,
        genre_target=normalized_genre,
    )

    return {
        "simple_suggestion": simple_suggestion,
        "creative_suggestion": creative_suggestion,
        "bold_suggestion": bold_suggestion,
        "paths": enriched_paths,
        "twists": twists[:4],
        "character_ideas": character_ideas[:4],
        "cast_names": cast_names,
        "cast_profiles": cast_profiles,
        "genre_applied": normalized_genre,
        "writing_mode": writing_mode,
        "writer_level": writer_level,
        "chapter_compass": chapter_compass,
        "continuity_alerts": continuity_alerts,
        "continuity_score": continuity_score,
        "reasoning": reasoning,
    }
