import json

from fastapi import APIRouter, HTTPException

from app.services.story_repository import (
	create_chapter,
	create_story,
	delete_chapter,
	delete_story,
	get_chapter,
	list_stories_with_chapters,
	save_chapter,
)

router = APIRouter(tags=["story"])


@router.get("/status")
def story_status():
	return {"status": "ok"}


@router.get("/modules")
def get_modules():
	return {"stories": list_stories_with_chapters()}


@router.post("/modules")
def create_story_module(payload: dict):
	title = str(payload.get("title") or "Untitled Story")
	story = create_story(title)
	return story


@router.post("/modules/{story_id}/chapters")
def create_story_chapter(story_id: str, payload: dict):
	title = str(payload.get("title") or "Untitled Chapter")
	try:
		chapter = create_chapter(story_id, title)
		return chapter
	except Exception as exc:
		raise HTTPException(status_code=400, detail=f"Failed to create chapter: {exc}")


@router.get("/modules/{story_id}/chapters/{chapter_id}")
def read_story_chapter(story_id: str, chapter_id: str):
	chapter = get_chapter(story_id, chapter_id)
	if not chapter:
		raise HTTPException(status_code=404, detail="Chapter not found")

	chapter["character_bible"] = json.loads(chapter.get("character_bible_json") or "[]")
	return chapter


@router.put("/modules/{story_id}/chapters/{chapter_id}")
def update_story_chapter(story_id: str, chapter_id: str, payload: dict):
	chapter = save_chapter(
		story_id,
		chapter_id,
		title=payload.get("title"),
		content=payload.get("content"),
		form=payload.get("form"),
		genre=payload.get("genre"),
		chapter_goal=payload.get("chapter_goal"),
		emotional_target=payload.get("emotional_target"),
		character_bible_json=json.dumps(payload.get("character_bible", [])),
	)

	if not chapter:
		raise HTTPException(status_code=404, detail="Chapter not found")

	chapter["character_bible"] = json.loads(chapter.get("character_bible_json") or "[]")
	return chapter


@router.delete("/modules/{story_id}/chapters/{chapter_id}")
def remove_story_chapter(story_id: str, chapter_id: str):
	ok = delete_chapter(story_id, chapter_id)
	if not ok:
		raise HTTPException(status_code=404, detail="Chapter not found")
	return {"deleted": True}


@router.delete("/modules/{story_id}")
def remove_story_module(story_id: str):
	ok = delete_story(story_id)
	if not ok:
		raise HTTPException(status_code=404, detail="Story not found")
	return {"deleted": True}
