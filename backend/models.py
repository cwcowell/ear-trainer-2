from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import String, Boolean, DateTime, ForeignKey, func
from datetime import datetime


class Base(DeclarativeBase):
    pass


class Session(Base):
    __tablename__ = "sessions"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    answers: Mapped[list["Answer"]] = relationship(back_populates="session")


class Answer(Base):
    __tablename__ = "answers"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id"))
    interval_name: Mapped[str] = mapped_column(String(8))
    user_answer: Mapped[str] = mapped_column(String(8))
    correct: Mapped[bool] = mapped_column(Boolean)
    answered_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    session: Mapped["Session"] = relationship(back_populates="answers")


class KeySigSession(Base):
    __tablename__ = "keysig_sessions"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    answers: Mapped[list["KeySigAnswer"]] = relationship(back_populates="session")


class KeySigAnswer(Base):
    __tablename__ = "keysig_answers"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("keysig_sessions.id"))
    key_name: Mapped[str] = mapped_column(String(8))
    user_answer: Mapped[str] = mapped_column(String(8))
    correct: Mapped[bool] = mapped_column(Boolean)
    answered_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    session: Mapped["KeySigSession"] = relationship(back_populates="answers")
