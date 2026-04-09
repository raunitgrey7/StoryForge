StoryForge
=========

StoryForge is an AI-assisted writing workspace for stories, poems, essays, and kids writing.
It provides:

- A chapter-based writing editor with genre and intensity controls.
- Multi-layer AI suggestions (simple, creative, bold, future paths).
- Cast and continuity guidance.
- Module and chapter persistence in SQLite.

Project Structure
-----------------

```text
StoryForge/
	backend/
		app/
			ai/            # model router, prompts, engine
			api/           # FastAPI routes
			core/          # app settings/config
			memory/        # story state updates
			models/        # request/response models
			services/      # intent service + sqlite repository
		requirements.txt
	frontend/
		index.html       # full UI (served by backend)
```

How It Works
------------

- Backend: FastAPI app serves APIs and the frontend.
- Frontend: Single-page app in `frontend/index.html`.
- AI Keys: Round-robin across 5 Gemini keys (`GOOGLE_API_KEY_1..5`).
- Persistence: SQLite database for stories and chapters.

Requirements
------------

- Python 3.11+ (recommended 3.11 or 3.12)
- Gemini API keys (at least 1, up to 5)

Environment Variables
---------------------

Create `backend/.env` (or project root `.env`) with:

```env
GOOGLE_API_KEY_1=your_key_here
GOOGLE_API_KEY_2=your_key_here
GOOGLE_API_KEY_3=your_key_here
GOOGLE_API_KEY_4=your_key_here
GOOGLE_API_KEY_5=your_key_here

ENV=development
DEBUG=true
```

Local Setup
-----------

1. Install dependencies:

```bash
cd backend
python -m venv .venv
# Windows PowerShell
.venv\Scripts\Activate.ps1
# macOS/Linux
# source .venv/bin/activate

pip install --upgrade pip
pip install -r requirements.txt
```

2. Run the app:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

If you run from the project root (without `cd backend`), use:

```bash
uvicorn --app-dir backend app.main:app --reload --host 0.0.0.0 --port 8000
```

3. Open in browser:

- App: `http://localhost:8000/`
- API docs: `http://localhost:8000/docs`

Key API Endpoints
-----------------

- `GET /api/health`
- `POST /suggest`
- `GET /api/story/modules`
- `POST /api/story/modules`
- `POST /api/story/modules/{story_id}/chapters`
- `GET /api/story/modules/{story_id}/chapters/{chapter_id}`
- `PUT /api/story/modules/{story_id}/chapters/{chapter_id}`
- `DELETE /api/story/modules/{story_id}/chapters/{chapter_id}`
- `DELETE /api/story/modules/{story_id}`

Deploy On Render
----------------

This project can be deployed as a single Render Web Service (backend serves frontend).

1. Push this repo to GitHub.
2. In Render, click New + -> Web Service.
3. Connect your repository.
4. Configure service (recommended, keeps paths simple):
	 - Root Directory: leave empty (repo root)
	 - Runtime: `Python 3`
	 - Build Command: `pip install -r backend/requirements.txt`
	 - Start Command: `uvicorn --app-dir backend app.main:app --host 0.0.0.0 --port $PORT`

Alternative: if you set Root Directory to `backend`, then keep:
	 - Build Command: `pip install -r requirements.txt`
	 - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add environment variables in Render:
	 - `GOOGLE_API_KEY_1` (required)
	 - `GOOGLE_API_KEY_2` to `GOOGLE_API_KEY_5` (optional)
	 - `ENV=production`
	 - `DEBUG=false`
6. Deploy.

After deploy:

- Your app URL will load the frontend directly.
- APIs are on the same domain (for example `https://your-app.onrender.com/suggest`).

Notes For Production
--------------------

- Render filesystem is ephemeral on free/starter instances, so local SQLite data can reset on redeploy/restart.
- For durable production data, move persistence to a managed database (for example Render PostgreSQL).
- Restrict CORS origins in production instead of `*`.

Troubleshooting
---------------

- If `/suggest` fails: verify at least one `GOOGLE_API_KEY_*` is set.
- If app boots but no UI: ensure `frontend/index.html` exists at repo root.
- If `.env` values do not load locally: verify you installed all packages from `requirements.txt` and run from `backend` directory.
- If `app.main:app` only works after `cd backend`: run Uvicorn with `--app-dir backend` from root.
