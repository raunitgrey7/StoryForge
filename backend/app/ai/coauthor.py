# backend/app/ai/coauthor.py

import json
import google.generativeai as genai
from app.core.config import settings
from app.ai.prompts import COAUTHOR_SYSTEM_PROMPT

genai.configure(api_key=settings.GOOGLE_API_KEY)
model = genai.GenerativeModel("gemini-2.5-flash")


def generate_suggestions(text: str, story_state: dict) -> dict:
    prompt = f"""
{COAUTHOR_SYSTEM_PROMPT}

--- STORY STATE ---
{json.dumps(story_state, indent=2)}

--- CURRENT TEXT ---
{text}
"""

    response = model.generate_content(prompt)

    try:
        parsed = json.loads(response.text)
        return parsed
    except Exception:
        # Hard fallback: silence, never garbage
        return {
            "suggestions": [
                {
                    "type": "Silence",
                    "content": "This moment may benefit from staying unresolved."
                }
            ]
        }
