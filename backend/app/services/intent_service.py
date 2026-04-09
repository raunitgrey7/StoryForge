import re
from typing import Literal


WritingMode = Literal["story", "poem", "essay", "dialogue", "children"]
WriterLevel = Literal["beginner", "intermediate", "advanced"]


def _word_count(text: str) -> int:
	return len(re.findall(r"\b\w+\b", text))


def detect_writing_mode(text: str, preferred_mode: str | None = None) -> WritingMode:
	if preferred_mode:
		mode = preferred_mode.strip().lower()
		if mode == "kids":
			return "children"
		if mode in {"story", "poem", "essay", "dialogue", "children"}:
			return mode  # user intent wins

	stripped = text.strip()
	if not stripped:
		return "story"

	lines = [ln.strip() for ln in stripped.splitlines() if ln.strip()]
	lowercase = stripped.lower()

	dialog_like = sum(1 for ln in lines if re.match(r'^("|\-|[A-Z][a-z]+:)', ln))
	if lines and dialog_like / max(len(lines), 1) >= 0.4:
		return "dialogue"

	short_lines = sum(1 for ln in lines if len(ln.split()) <= 10)
	if len(lines) >= 4 and short_lines / max(len(lines), 1) >= 0.6:
		return "poem"

	children_markers = ["once upon", "little", "magic", "friendly", "adventure", "bedtime"]
	simple_sentences = sum(1 for s in re.split(r"[.!?]", stripped) if 0 < len(s.split()) <= 10)
	if any(marker in lowercase for marker in children_markers) and simple_sentences >= 2:
		return "children"

	essay_markers = ["therefore", "however", "in conclusion", "thesis", "evidence", "argument"]
	if any(marker in lowercase for marker in essay_markers):
		return "essay"

	return "story"


def detect_writer_level(text: str) -> WriterLevel:
	words = _word_count(text)
	if words < 80:
		return "beginner"

	sentence_chunks = [s.strip() for s in re.split(r"[.!?]", text) if s.strip()]
	avg_sentence_len = (
		sum(len(re.findall(r"\b\w+\b", s)) for s in sentence_chunks) / max(len(sentence_chunks), 1)
	)

	advanced_markers = len(re.findall(r"\b(although|whereas|nonetheless|consequently|ambiguous|juxtapose)\b", text.lower()))
	punctuation_complexity = len(re.findall(r"[;:—-]", text))

	if words >= 260 and avg_sentence_len >= 16 and (advanced_markers >= 2 or punctuation_complexity >= 4):
		return "advanced"

	if words >= 120 and avg_sentence_len >= 11:
		return "intermediate"

	return "beginner"


def detect_pacing_habit(text: str) -> str:
	sentence_chunks = [s.strip() for s in re.split(r"[.!?]", text) if s.strip()]
	if not sentence_chunks:
		return "balanced"

	avg_sentence_len = sum(len(s.split()) for s in sentence_chunks) / len(sentence_chunks)
	if avg_sentence_len <= 10:
		return "fast"
	if avg_sentence_len >= 18:
		return "deliberate"
	return "balanced"


def infer_writing_style(text: str, writing_mode: WritingMode) -> str:
	text_lower = text.lower()
	if writing_mode == "poem":
		return "lyrical"
	if writing_mode == "essay":
		return "analytical"
	if writing_mode == "dialogue":
		return "conversational"
	if writing_mode == "children":
		return "playful"
	if "dream" in text_lower or "symbol" in text_lower:
		return "impressionistic"
	return "narrative"
