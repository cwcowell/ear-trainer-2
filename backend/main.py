import random
import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend")

app = FastAPI()

INTERVALS = [
    ("m2", 1),
    ("M2", 2),
    ("m3", 3),
    ("M3", 4),
    ("P4", 5),
    ("TT", 6),
    ("P5", 7),
    ("m6", 8),
    ("M6", 9),
    ("m7", 10),
    ("M7", 11),
    ("P8", 12),
]

KEY_SIGNATURES = [
    "Ab", "A", "Bb", "B", "Cb", "C", "C#", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G"
]

ROOT_NOTES_HZ = [
    130.81, 138.59, 146.83, 155.56, 164.81, 174.61,
    185.00, 196.00, 207.65, 220.00, 233.08, 246.94,
    261.63, 277.18, 293.66, 311.13, 329.63, 349.23,
    369.99, 392.00, 415.30, 440.00, 466.16, 493.88,
    523.25,
]


@app.get("/api/interval")
async def get_interval():
    """Return a random interval for the user to identify."""
    root_freq = random.choice(ROOT_NOTES_HZ)
    name, semitones = random.choice(INTERVALS)
    second_freq = root_freq * (2 ** (semitones / 12))
    if random.choice([True, False]):
        root_freq, second_freq = second_freq, root_freq
    return {
        "root_freq": round(root_freq, 2),
        "second_freq": round(second_freq, 2),
        "interval_semitones": semitones,
        "interval_name": name,
    }


@app.get("/api/keysig")
async def get_keysig():
    """Return a random key signature for the user to identify."""
    return {"key_name": random.choice(KEY_SIGNATURES)}


# Static file serving (must be last)
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="static")
