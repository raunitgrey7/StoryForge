from itertools import cycle
from threading import Lock

from google import genai

from app.core.config import settings


class GeminiModelRouter:
	def __init__(self, keys: list[str], model_name: str = "gemini-2.5-flash"):
		if not keys:
			raise ValueError(
				"No Gemini API keys configured. Set GOOGLE_API_KEY_1..GOOGLE_API_KEY_5 in .env"
			)
		self._keys = keys
		self._model_name = model_name
		self._cycle = cycle(self._keys)
		self._lock = Lock()

	def get_client_and_model(self) -> tuple[genai.Client, str]:
		with self._lock:
			key = next(self._cycle)
		client = genai.Client(api_key=key)
		return client, self._model_name


router = GeminiModelRouter(settings.google_api_keys)


def get_rotating_client_and_model() -> tuple[genai.Client, str]:
	return router.get_client_and_model()
