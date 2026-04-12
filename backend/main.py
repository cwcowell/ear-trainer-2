import random
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select, func, cast, Integer
from pydantic import BaseModel
from models import Base, Session as DbSession, Answer, KeySigSession, KeySigAnswer

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
FRONTEND_DIR = os.path.join(BASE_DIR, "..", "frontend")

# Database setup
engine = create_async_engine(f"sqlite+aiosqlite:///{DATA_DIR}/eartrainer.db", echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(DATA_DIR, exist_ok=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(lifespan=lifespan)


# Interval definitions
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

# Key Signatures (all 15 major keys)
KEY_SIGNATURES = [
    "Ab", "A", "Bb", "B", "Cb", "C", "C#", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G"
]

# Root note range: C3 (130.81 Hz) to C5 (523.25 Hz)
ROOT_NOTES_HZ = [
    130.81, 138.59, 146.83, 155.56, 164.81, 174.61,
    185.00, 196.00, 207.65, 220.00, 233.08, 246.94,
    261.63, 277.18, 293.66, 311.13, 329.63, 349.23,
    369.99, 392.00, 415.30, 440.00, 466.16, 493.88,
    523.25,
]


# Pydantic models for request/response validation
class AnswerRequest(BaseModel):
    interval_name: str
    user_answer: str


class KeySigAnswerRequest(BaseModel):
    key_name: str
    user_answer: str


# API Endpoints
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


@app.post("/api/session", status_code=201)
async def create_session():
    """Create a new training session."""
    async with AsyncSessionLocal() as db:
        session = DbSession()
        db.add(session)
        await db.commit()
        await db.refresh(session)
        return {"session_id": session.id}


@app.post("/api/session/{session_id}/answer")
async def record_answer(session_id: int, body: AnswerRequest):
    """Record a user's answer for the current interval."""
    correct = body.interval_name == body.user_answer
    async with AsyncSessionLocal() as db:
        session = await db.get(DbSession, session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        answer = Answer(
            session_id=session_id,
            interval_name=body.interval_name,
            user_answer=body.user_answer,
            correct=correct,
        )
        db.add(answer)
        await db.commit()

        # Return updated stats in one query
        result = await db.execute(
            select(
                func.count(Answer.id).label("total"),
                func.sum(cast(Answer.correct, Integer)).label("correct_count")
            ).where(Answer.session_id == session_id)
        )
        row = result.one()
        return {
            "correct": correct,
            "total": row.total,
            "correct_count": row.correct_count or 0,
        }


@app.get("/api/session/{session_id}")
async def get_session(session_id: int):
    """Retrieve session stats."""
    async with AsyncSessionLocal() as db:
        session = await db.get(DbSession, session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        result = await db.execute(
            select(
                func.count(Answer.id),
                func.sum(cast(Answer.correct, Integer))
            ).where(Answer.session_id == session_id)
        )
        total, correct_count = result.one()
        return {
            "session_id": session_id,
            "created_at": session.created_at.isoformat(),
            "total": total,
            "correct_count": correct_count or 0,
        }


# Key Signature API Endpoints
@app.get("/api/keysig")
async def get_keysig():
    """Return a random key signature for the user to identify."""
    key_name = random.choice(KEY_SIGNATURES)
    return {"key_name": key_name}


@app.post("/api/keysig-session", status_code=201)
async def create_keysig_session():
    """Create a new key signature training session."""
    async with AsyncSessionLocal() as db:
        session = KeySigSession()
        db.add(session)
        await db.commit()
        await db.refresh(session)
        return {"session_id": session.id}


@app.post("/api/keysig-session/{session_id}/answer")
async def record_keysig_answer(session_id: int, body: KeySigAnswerRequest):
    """Record a user's answer for the current key signature."""
    correct = body.key_name == body.user_answer
    async with AsyncSessionLocal() as db:
        session = await db.get(KeySigSession, session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        answer = KeySigAnswer(
            session_id=session_id,
            key_name=body.key_name,
            user_answer=body.user_answer,
            correct=correct,
        )
        db.add(answer)
        await db.commit()

        # Return updated stats in one query
        result = await db.execute(
            select(
                func.count(KeySigAnswer.id).label("total"),
                func.sum(cast(KeySigAnswer.correct, Integer)).label("correct_count")
            ).where(KeySigAnswer.session_id == session_id)
        )
        row = result.one()
        return {
            "correct": correct,
            "total": row.total,
            "correct_count": row.correct_count or 0,
        }


@app.get("/api/keysig-session/{session_id}")
async def get_keysig_session(session_id: int):
    """Retrieve key signature session stats."""
    async with AsyncSessionLocal() as db:
        session = await db.get(KeySigSession, session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        result = await db.execute(
            select(
                func.count(KeySigAnswer.id),
                func.sum(cast(KeySigAnswer.correct, Integer))
            ).where(KeySigAnswer.session_id == session_id)
        )
        total, correct_count = result.one()
        return {
            "session_id": session_id,
            "created_at": session.created_at.isoformat(),
            "total": total,
            "correct_count": correct_count or 0,
        }


@app.delete("/api/stats", status_code=204)
async def reset_stats():
    """Delete all answers and sessions."""
    async with AsyncSessionLocal() as db:
        await db.execute(Answer.__table__.delete())
        await db.execute(KeySigAnswer.__table__.delete())
        await db.execute(DbSession.__table__.delete())
        await db.execute(KeySigSession.__table__.delete())
        await db.commit()


@app.get("/api/stats")
async def get_all_stats():
    """Return all-time aggregated stats for every interval and key signature."""
    async with AsyncSessionLocal() as db:
        interval_rows = await db.execute(
            select(
                Answer.interval_name,
                func.count(Answer.id).label("attempted"),
                func.sum(Answer.correct).label("correct"),
            ).group_by(Answer.interval_name)
        )
        keysig_rows = await db.execute(
            select(
                KeySigAnswer.key_name,
                func.count(KeySigAnswer.id).label("attempted"),
                func.sum(KeySigAnswer.correct).label("correct"),
            ).group_by(KeySigAnswer.key_name)
        )

    intervals = {row.interval_name: {"correct": row.correct or 0, "attempted": row.attempted}
                 for row in interval_rows}
    key_signatures = {row.key_name: {"correct": row.correct or 0, "attempted": row.attempted}
                      for row in keysig_rows}
    return {"intervals": intervals, "key_signatures": key_signatures}


# Static file serving (must be last)
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="static")
