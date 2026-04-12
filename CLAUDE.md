# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start

```bash
# Install dependencies (one-time)
pip install -r backend/requirements.txt

# Run the app
./run.sh

# Open in browser: http://localhost:8000
# FastAPI auto-generated docs: http://localhost:8000/docs
```

To inspect the database:
```bash
sqlite3 backend/data/eartrainer.db "SELECT * FROM answers;"
```

## Architecture Overview

This is a three-tier web app for musical interval training:

**Frontend** (`frontend/`): Single-page vanilla JavaScript app
- Three screens: main menu, interval training game, key signatures game
- Interval game loop: plays random interval → user clicks button → records answer → auto-advances
- Key signatures game loop: displays random key signature on staff → user clicks button → records answer → auto-advances
- Uses Web Audio API to generate sine wave tones (no audio files)
- Uses VexFlow library (loaded via CDN) to render key signatures on a treble clef staff
- State machines in `app.js` manage game flow and session persistence for each game mode

**Backend** (`backend/main.py`): FastAPI app that does two things:
1. Serves static frontend files at `/` (no CORS needed, same-origin)
2. Provides REST API at `/api/` for game logic and persistence

**Database models** (`backend/models.py`): SQLAlchemy ORM models
- `Session` / `Answer`: interval training tables
- `KeySigSession` / `KeySigAnswer`: key signatures training tables

**Database**: SQLite file at `data/eartrainer.db` (inside the backend directory)
- `sessions` table: one record per interval training session
- `answers` table: one record per interval question answered
- `keysig_sessions` table: one record per key signatures session
- `keysig_answers` table: one record per key signature question answered
- Data persists in `backend/data/`

## Key Code Patterns

### Frontend Game Flow (`app.js`)

The `state` object holds interval training state:
```javascript
state = {
  sessionId,       // current session ID from backend
  currentInterval, // { root_freq, second_freq, interval_name, interval_semitones }
  score,           // { correct: 0, total: 0 }
  audioCtx,        // Web Audio context (created lazily on first button click)
  answered,        // guard against double-submission
  intervalStats,   // { [intervalName]: { correct, attempted } } — seeded from /api/stats on load
}
```

The `keySigState` object holds key signatures state:
```javascript
keySigState = {
  sessionId,   // current session ID from backend
  currentKey,  // key name string, e.g. "Ab"
  score,       // { correct: 0, total: 0 }
  answered,    // guard against double-submission
  keyStats,    // { [keyName]: { correct, attempted } } — seeded from /api/stats on load
}
```

**Critical audio timing** (in `playInterval()`):
- Both notes scheduled relative to `audioCtx.currentTime` for precision
- First note at `now`, second note at `now + 1.0` (0.2s gap between notes)
- Gain envelope (10ms attack, 50ms release) prevents audible clicks
- Answer buttons enabled ~1.9s after play starts (after both notes finish)
- Next interval auto-loads 1.5s after user submits answer

**Key signature rendering** (in `renderKeySignature()`):
- Uses VexFlow `Renderer`, `Stave`, `addClef()`, and `addKeySignature()` to draw on a SVG canvas
- Container div `#keysig-staff` is cleared and re-rendered on each new question

**Interval buttons** are auto-generated from the `INTERVALS` array — add/remove intervals by modifying this array, not by editing HTML.

**Key signature buttons** are auto-generated from the `KEY_SIGNATURES` array (15 major keys, ordered by ascending pitch starting with Ab).

### Backend API (`backend/main.py`)

Ten endpoints, all returning JSON:

**Interval Training:**
- `GET /api/interval` — Returns `{ root_freq, second_freq, interval_name, interval_semitones }`. Frequencies are in Hz; note the range is C3–C5 to keep second notes below ~4 kHz.
- `POST /api/session` — Creates a session, returns `{ session_id }`. Called once per game.
- `POST /api/session/{id}/answer` — Records answer. Request body: `{ interval_name, user_answer }`. Returns `{ correct: bool, total: count, correct_count: count }`.
- `GET /api/session/{id}` — Retrieves session stats.

**Key Signatures:**
- `GET /api/keysig` — Returns `{ key_name }` (e.g. `"Ab"`).
- `POST /api/keysig-session` — Creates a key sig session, returns `{ session_id }`.
- `POST /api/keysig-session/{id}/answer` — Records answer. Request body: `{ key_name, user_answer }`. Returns `{ correct: bool, total: count, correct_count: count }`.
- `GET /api/keysig-session/{id}` — Retrieves key sig session stats.

**Stats:**
- `GET /api/stats` — Returns all-time aggregated stats for every interval and key signature.
- `DELETE /api/stats` — Resets all stats (deletes all answers and sessions).

**Database access**: Uses SQLAlchemy async (via `aiosqlite`) with `AsyncSessionLocal()` context manager. The `lifespan` context manager creates the DB schema on startup.

### Important Constraints

1. **Web Audio**: `AudioContext` must be created inside a user gesture (button click). Currently created lazily in `playInterval()` on first "Play Interval" button click.

2. **Static file mount**: The `app.mount("/", StaticFiles(...))` line in `main.py` must be the **last line**. FastAPI routes requests in order; the static mount is a catch-all that catches everything not matched by earlier routes.

3. **12 intervals**: Defined in `backend/main.py` as semitones (1–12). Interval names are `m2 M2 m3 M3 P4 TT P5 m6 M6 m7 M7 P8`. This same list is replicated in `frontend/app.js` as the `INTERVALS` array — keep them in sync.

4. **15 key signatures**: Defined in both `backend/main.py` and `frontend/app.js` as the `KEY_SIGNATURES` array. Ordered by ascending pitch starting with Ab: `Ab A Bb B Cb C C# Db D Eb E F F# Gb G` — keep them in sync.
