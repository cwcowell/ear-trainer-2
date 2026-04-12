# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start

```bash
# Install dependencies (one-time)
pip install -r backend/requirements.txt

# Run the app
./run.sh

# Open in browser: http://localhost:8000
```

## Architecture Overview

A small two-tier web app for musical ear training. No database, no session persistence — score is tracked in memory for the duration of a single screen visit.

**Frontend** (`frontend/`): Single-page vanilla JavaScript app. All game logic (random interval/key-signature picking, scoring) runs here.
- Three screens: main menu, interval training, key signatures.
- Web Audio API generates sine/sawtooth/square tones (no audio files).
- VexFlow (loaded via CDN) renders key signatures on a treble clef staff.
- Two independent state objects in `app.js`: `state` (intervals) and `keySigState` (key signatures).

**Backend** (`backend/main.py`): FastAPI app that only serves the static frontend. There are no API endpoints — the entire file is a `StaticFiles` mount.

## Key Code Patterns

### Frontend Game Flow (`app.js`)

Constants at the top of the file:
- `INTERVALS` — 12 intervals as `{ name, semitones }` objects (m2 through P8).
- `KEY_SIGNATURES` — 15 major keys, ordered by ascending pitch starting with Ab.
- `ROOT_NOTES_HZ` — chromatic C3–C5 root frequencies, chosen so the second note of any interval stays below ~4 kHz.

`pickInterval()` and `loadNextKey()` generate questions locally; no network calls are made during gameplay.

**Interval game state**:
```javascript
state = {
  currentInterval, // { firstFreq, secondFreq, name }
  score,           // { correct, total }
  audioCtx,        // Web Audio context (created lazily on first click)
  answered,        // guard against double-submission
  waveform,        // 'sine' | 'sawtooth' | 'square'
}
```

**Key signatures state**:
```javascript
keySigState = {
  currentKey,  // e.g. "Ab"
  score,       // { correct, total }
  answered,
}
```

**Critical audio timing** (in `playInterval()`):
- Both notes scheduled relative to `audioCtx.currentTime` for precision.
- First note at `now`, second note at `now + 1.0` (0.2s gap between notes).
- Gain envelope (10ms attack, 50ms release) prevents audible clicks.
- Answer buttons enabled ~1.9s after play starts.

**Answer feedback**: no text messages — a correct guess flashes the clicked button green for 900ms before advancing. A wrong guess flashes the clicked button red and the correct button green for 2s, then advances at 2.7s.

**Key signature rendering** (in `renderKeySignature()`): uses VexFlow `Renderer`, `Stave`, `addClef('treble')`, and `addKeySignature()` to draw SVG into `#keysig-staff`. The container is cleared and re-rendered on every new question.

Interval and key-signature buttons are generated from the `INTERVALS` and `KEY_SIGNATURES` arrays — add/remove options by editing those arrays, not the HTML.

### Backend (`backend/main.py`)

Just a `StaticFiles` mount on `/`. Nothing else. If you need an endpoint, add it above the mount — FastAPI matches routes in order and the static mount is a catch-all.

### Important Constraints

1. **Web Audio**: `AudioContext` must be created inside a user gesture. It is created lazily inside `playInterval()`, and the first `playInterval` call per session is reached via a button click, so the gesture chain is preserved.
2. **Static mount must be last** in `main.py` (see above).
