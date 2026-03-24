import enum
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Enum, DateTime, Integer, Boolean, ForeignKey
from .database import Base


class BrandEnum(str, enum.Enum):
    GUIDA_E_VAI = "guida-e-vai"
    QUIZ_PATENTE = "quiz-patente"
    RINNOVALA = "rinnovala"


class ContentTypeEnum(str, enum.Enum):
    VIDEO = "video"
    GRAFICA = "grafica"


class ChannelEnum(str, enum.Enum):
    ORGANICO = "organico"
    ADV = "adv"


class SourceEnum(str, enum.Enum):
    INTERNO = "interno"
    MARKETING = "marketing"


class StatusEnum(str, enum.Enum):
    DA_ASSEGNARE = "da-assegnare"
    IN_LAVORAZIONE = "in-lavorazione"
    IN_REVISIONE = "in-revisione"
    COMPLETATO = "completato"
    ARCHIVIATO = "archiviato"


class AssigneeEnum(str, enum.Enum):
    FEDERICO = "federico"
    MARZIA = "marzia"


class BriefTypeEnum(str, enum.Enum):
    SCRIPT = "script"
    BRIEF = "brief"


class DevTaskStatusEnum(str, enum.Enum):
    IN_CORSO = "in-corso"
    COMPLETATO = "completato"


class ScriptBrief(Base):
    __tablename__ = "script_briefs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    brief_type = Column(Enum(BriefTypeEnum), nullable=False)
    brand = Column(Enum(BrandEnum), nullable=False)
    content = Column(Text, nullable=False)
    notes = Column(Text, nullable=True)
    assigned_to = Column(Enum(AssigneeEnum), nullable=True)
    is_used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class Content(Base):
    __tablename__ = "contents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    brand = Column(Enum(BrandEnum), nullable=False)
    content_type = Column(Enum(ContentTypeEnum), nullable=False)
    channel = Column(Enum(ChannelEnum), nullable=False)
    source = Column(Enum(SourceEnum), nullable=False, default=SourceEnum.INTERNO)
    assigned_to = Column(Enum(AssigneeEnum), nullable=True)
    status = Column(Enum(StatusEnum), nullable=False, default=StatusEnum.DA_ASSEGNARE)
    script = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    deadline = Column(DateTime, nullable=True)
    file_name = Column(String(500), nullable=True)
    file_path = Column(String(500), nullable=True)
    thumbnail_path = Column(String(500), nullable=True)
    drive_link = Column(String(500), nullable=True)
    script_brief_id = Column(Integer, ForeignKey("script_briefs.id"), nullable=True)

    @property
    def has_thumbnail(self) -> bool:
        return bool(self.thumbnail_path)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)
    archived_at = Column(DateTime, nullable=True)


class Activity(Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, autoincrement=True)
    content_id = Column(Integer, nullable=False, index=True)
    action = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class DevTask(Base):
    __tablename__ = "dev_tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    estimated_hours = Column(Integer, nullable=True)
    status = Column(Enum(DevTaskStatusEnum), nullable=False, default=DevTaskStatusEnum.IN_CORSO)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    content_id = Column(Integer, nullable=False, index=True)
    author = Column(String(100), nullable=False)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
