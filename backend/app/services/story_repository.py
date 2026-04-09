import sqlite3
import uuid
from pathlib import Path
from typing import Any


DB_PATH = Path(__file__).resolve().parents[3] / "storyforge.db"


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS stories (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS chapters (
                id TEXT PRIMARY KEY,
                story_id TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '',
                form TEXT,
                genre TEXT,
                chapter_goal TEXT,
                emotional_target TEXT,
                character_bible_json TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(story_id) REFERENCES stories(id) ON DELETE CASCADE
            )
            """
        )


def _as_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {key: row[key] for key in row.keys()}


def create_story(title: str) -> dict[str, Any]:
    story_id = str(uuid.uuid4())
    with _connect() as conn:
        conn.execute(
            "INSERT INTO stories (id, title) VALUES (?, ?)",
            (story_id, title.strip() or "Untitled Story"),
        )
        conn.execute(
            """
            INSERT INTO chapters (id, story_id, title)
            VALUES (?, ?, ?)
            """,
            (str(uuid.uuid4()), story_id, "Chapter 1"),
        )
        row = conn.execute("SELECT * FROM stories WHERE id = ?", (story_id,)).fetchone()
    return _as_dict(row)


def list_stories_with_chapters() -> list[dict[str, Any]]:
    with _connect() as conn:
        stories = conn.execute(
            "SELECT * FROM stories ORDER BY updated_at DESC, created_at DESC"
        ).fetchall()
        story_data: list[dict[str, Any]] = []

        for story_row in stories:
            story = _as_dict(story_row)
            chapters = conn.execute(
                "SELECT * FROM chapters WHERE story_id = ? ORDER BY created_at ASC",
                (story["id"],),
            ).fetchall()
            story["chapters"] = [_as_dict(ch) for ch in chapters]
            story_data.append(story)

    return story_data


def create_chapter(story_id: str, title: str) -> dict[str, Any]:
    chapter_id = str(uuid.uuid4())
    with _connect() as conn:
        conn.execute(
            "INSERT INTO chapters (id, story_id, title) VALUES (?, ?, ?)",
            (chapter_id, story_id, title.strip() or "Untitled Chapter"),
        )
        conn.execute(
            "UPDATE stories SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (story_id,),
        )
        row = conn.execute("SELECT * FROM chapters WHERE id = ?", (chapter_id,)).fetchone()
    return _as_dict(row)


def get_chapter(story_id: str, chapter_id: str) -> dict[str, Any] | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM chapters WHERE id = ? AND story_id = ?",
            (chapter_id, story_id),
        ).fetchone()
        if not row:
            return None
    return _as_dict(row)


def save_chapter(
    story_id: str,
    chapter_id: str,
    *,
    title: str | None = None,
    content: str | None = None,
    form: str | None = None,
    genre: str | None = None,
    chapter_goal: str | None = None,
    emotional_target: str | None = None,
    character_bible_json: str | None = None,
) -> dict[str, Any] | None:
    existing = get_chapter(story_id, chapter_id)
    if not existing:
        return None

    payload = {
        "title": title if title is not None else existing["title"],
        "content": content if content is not None else existing["content"],
        "form": form if form is not None else existing["form"],
        "genre": genre if genre is not None else existing["genre"],
        "chapter_goal": chapter_goal if chapter_goal is not None else existing["chapter_goal"],
        "emotional_target": emotional_target if emotional_target is not None else existing["emotional_target"],
        "character_bible_json": (
            character_bible_json if character_bible_json is not None else existing["character_bible_json"]
        ),
    }

    with _connect() as conn:
        conn.execute(
            """
            UPDATE chapters
            SET title = ?, content = ?, form = ?, genre = ?,
                chapter_goal = ?, emotional_target = ?, character_bible_json = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND story_id = ?
            """,
            (
                payload["title"],
                payload["content"],
                payload["form"],
                payload["genre"],
                payload["chapter_goal"],
                payload["emotional_target"],
                payload["character_bible_json"],
                chapter_id,
                story_id,
            ),
        )
        conn.execute(
            "UPDATE stories SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (story_id,),
        )

    return get_chapter(story_id, chapter_id)


def delete_chapter(story_id: str, chapter_id: str) -> bool:
    with _connect() as conn:
        cursor = conn.execute(
            "DELETE FROM chapters WHERE id = ? AND story_id = ?",
            (chapter_id, story_id),
        )
        conn.execute(
            "UPDATE stories SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (story_id,),
        )
    return cursor.rowcount > 0


def delete_story(story_id: str) -> bool:
    with _connect() as conn:
        conn.execute("DELETE FROM chapters WHERE story_id = ?", (story_id,))
        cursor = conn.execute("DELETE FROM stories WHERE id = ?", (story_id,))
    return cursor.rowcount > 0
