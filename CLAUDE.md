# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start

```bash
# Build and run the app (requires Docker and Docker Compose)
docker compose up --build

# Open in browser: http://localhost:8000
# FastAPI auto-generated docs: http://localhost:8000/docs
```

To inspect the database:
```bash
docker compose exec db mariadb -u eartrainer -pearpass eartrainer -e "SELECT * FROM answers;"
```

## Architecture Overview

This is a three-tier web app for musical interval training:

**Frontend** (`frontend/`): Single-page vanilla JavaScript app
- Two screens: main menu and interval training game
- Game loop: plays random interval → user clicks button → records answer → auto-advances
- Uses Web Audio API to generate sine wave tones (no audio files)
- State machine in `app.js` manages game flow and session persistence

**Backend** (`backend/main.py`): FastAPI app that does two things:
1. Serves static frontend files at `/` (no CORS needed, same-origin)
2. Provides REST API at `/api/` for game logic and persistence

**Database** (`docker-compose.yml`): MariaDB 11.3 stores user session data
- `sessions` table: one record per game session
- `answers` table: one record per question answered
- Data persists in named volume `db_data`

## Key Code Patterns

### Frontend Game Flow (`app.js`)

The `state` object holds all game state:
```javascript
state = {
  sessionId,       // current session ID from backend
  currentInterval, // { root_freq, second_freq, interval_name, interval_semitones }
  score,           // { correct: 0, total: 0 }
  audioCtx,        // Web Audio context (created lazily on first button click)
  answered,        // guard against double-submission
}
```

**Critical audio timing** (in `playInterval()`):
- Both notes scheduled relative to `audioCtx.currentTime` for precision
- First note at `now`, second note at `now + 1.0` (0.2s gap between notes)
- Gain envelope (10ms attack, 50ms release) prevents audible clicks
- Answer buttons enabled ~1.9s after play starts (after both notes finish)
- Next interval auto-loads 1.5s after user submits answer

**Interval buttons** are auto-generated from the `INTERVALS` array — add/remove intervals by modifying this array, not by editing HTML.

### Backend API (`backend/main.py`)

Four endpoints, all returning JSON:

- `GET /api/interval` — Returns `{ root_freq, second_freq, interval_name, interval_semitones }`. Frequencies are in Hz; note the range is C3–C5 to keep second notes below ~4 kHz.

- `POST /api/session` — Creates a session, returns `{ session_id }`. Called once per game.

- `POST /api/session/{id}/answer` — Records answer. Request body: `{ interval_name, user_answer }`. Returns `{ correct: bool, total: count, correct_count: count }`.

- `GET /api/session/{id}` — Retrieves session stats.

**Database access**: Uses SQLAlchemy async (via `aiomysql`) with `AsyncSessionLocal()` context manager. The `lifespan` context manager initializes the DB schema on startup with a retry loop (handles MariaDB startup delay).

### Important Constraints

1. **Web Audio**: `AudioContext` must be created inside a user gesture (button click). Currently created lazily in `playTone()` on first "Play Interval" button click.

2. **Static file mount**: The `app.mount("/", StaticFiles(...))` line in `main.py` must be the **last line**. FastAPI routes requests in order; the static mount is a catch-all that catches everything not matched by earlier routes.

3. **MariaDB boolean SUM**: When aggregating the `correct` boolean column, use `.cast(Integer)` with `func.sum()` — MariaDB doesn't sum TINYINT(1) directly. See `backend/main.py` for examples.

4. **Database hostname**: In Docker Compose, the DB hostname is `db` (the service name), not `localhost`. This is configured in `docker-compose.yml` env var `DB_URL`.

5. **13 intervals**: Defined in `backend/main.py` as semitones (0–12). Interval names are `P1 m2 M2 m3 M3 P4 TT P5 m6 M6 m7 M7 P8`. This same list is replicated in `frontend/app.js` as the `INTERVALS` array — keep them in sync.

## Future Extension Points

- **Add menu items**: Create new `div.screen` in `index.html`, add button in `#screen-menu`, implement handler in `app.js`.
- **New game modes**: Create new API endpoints in `main.py` (e.g., `/api/chord`, `/api/scale`), corresponding game logic in `app.js`.
- **Persistence**: Sessions and answers are already persisted in MariaDB. To retrieve a user's history, query the `answers` table by `session_id` or add a user auth layer.
- **Audio**: Currently uses sine waves. To support different tones (e.g., piano), generate different waveforms or replace with sampled audio files.

## Testing Notes

No automated tests are currently configured. To add:
- Backend: Use `pytest` with `httpx.AsyncClient` to test FastAPI endpoints.
- Frontend: Use a test runner like Vitest or Jest with `jsdom` to mock Web Audio API.
- Integration: Run full flow via Docker Compose and verify DB state.
