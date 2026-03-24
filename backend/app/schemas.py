from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_validator


class ContentCreate(BaseModel):
    title: str
    brand: str
    content_type: str
    channel: str
    source: str = "interno"
    assigned_to: Optional[str] = None
    script: Optional[str] = None
    notes: Optional[str] = None
    deadline: Optional[datetime] = None
    script_brief_id: Optional[int] = None

    @field_validator('title')
    @classmethod
    def title_length(cls, v):
        v = v.strip()
        if not v or len(v) > 255:
            raise ValueError('Il titolo deve avere tra 1 e 255 caratteri')
        return v

    @field_validator('script')
    @classmethod
    def script_length(cls, v):
        if v and len(v) > 50000:
            raise ValueError('Lo script non può superare i 50.000 caratteri')
        return v

    @field_validator('notes')
    @classmethod
    def notes_length(cls, v):
        if v and len(v) > 10000:
            raise ValueError('Le note non possono superare i 10.000 caratteri')
        return v


class ContentUpdate(BaseModel):
    title: Optional[str] = None
    brand: Optional[str] = None
    content_type: Optional[str] = None
    channel: Optional[str] = None
    source: Optional[str] = None
    assigned_to: Optional[str] = None
    status: Optional[str] = None
    script: Optional[str] = None
    notes: Optional[str] = None
    deadline: Optional[datetime] = None
    drive_link: Optional[str] = None
    script_brief_id: Optional[int] = None

    @field_validator('title')
    @classmethod
    def title_length(cls, v):
        if v is not None:
            v = v.strip()
            if not v or len(v) > 255:
                raise ValueError('Il titolo deve avere tra 1 e 255 caratteri')
        return v

    @field_validator('script')
    @classmethod
    def script_length(cls, v):
        if v and len(v) > 50000:
            raise ValueError('Lo script non può superare i 50.000 caratteri')
        return v

    @field_validator('notes')
    @classmethod
    def notes_length(cls, v):
        if v and len(v) > 10000:
            raise ValueError('Le note non possono superare i 10.000 caratteri')
        return v

    @field_validator('drive_link')
    @classmethod
    def drive_link_valid(cls, v):
        if v and len(v) > 500:
            raise ValueError('Il link Drive non può superare i 500 caratteri')
        if v and not (v.startswith('https://') or v.startswith('http://')):
            raise ValueError('Il link Drive deve iniziare con https://')
        return v


class ContentResponse(BaseModel):
    id: int
    title: str
    brand: str
    content_type: str
    channel: str
    source: str
    assigned_to: Optional[str]
    status: str
    script: Optional[str]
    notes: Optional[str]
    deadline: Optional[datetime]
    file_name: Optional[str]
    has_thumbnail: bool = False
    # file_path removed — never expose internal server paths
    drive_link: Optional[str]
    drive_file_id: Optional[str] = None
    script_brief_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]
    archived_at: Optional[datetime]

    class Config:
        from_attributes = True


class StatsResponse(BaseModel):
    da_assegnare: int
    in_lavorazione: int
    in_revisione: int
    completato: int
    archiviato: int
    totale_attivi: int
    federico_attivi: int
    marzia_attivi: int
    da_marketing: int
    scaduti: int


class BrandSummary(BaseModel):
    brand: str
    brand_label: str
    totale: int
    video: int
    grafica: int
    sviluppo: int = 0
    organico: int
    adv: int


class ActivityResponse(BaseModel):
    id: int
    content_id: int
    action: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Script / Brief ──────────────────────────────────────

class ScriptBriefCreate(BaseModel):
    title: str
    brief_type: str  # "script" or "brief"
    brand: str
    content: str
    notes: Optional[str] = None
    assigned_to: Optional[str] = None

    @field_validator('title')
    @classmethod
    def title_length(cls, v):
        v = v.strip()
        if not v or len(v) > 255:
            raise ValueError('Il titolo deve avere tra 1 e 255 caratteri')
        return v

    @field_validator('content')
    @classmethod
    def content_length(cls, v):
        v = v.strip()
        if not v or len(v) > 50000:
            raise ValueError('Il contenuto deve avere tra 1 e 50.000 caratteri')
        return v


class ScriptBriefUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    notes: Optional[str] = None
    assigned_to: Optional[str] = None
    is_used: Optional[bool] = None


class ScriptBriefResponse(BaseModel):
    id: int
    title: str
    brief_type: str
    brand: str
    content: str
    notes: Optional[str]
    assigned_to: Optional[str]
    is_used: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Dev Tasks (Federico) ───────────────────────────────────

class DevTaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    estimated_hours: Optional[int] = None

    @field_validator('title')
    @classmethod
    def title_length(cls, v):
        v = v.strip()
        if not v or len(v) > 255:
            raise ValueError('Il titolo deve avere tra 1 e 255 caratteri')
        return v


class DevTaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    estimated_hours: Optional[int] = None
    status: Optional[str] = None


class DevTaskResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    estimated_hours: Optional[int]
    status: str
    created_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class CommentCreate(BaseModel):
    text: str

    @field_validator('text')
    @classmethod
    def text_length(cls, v):
        v = v.strip()
        if not v or len(v) > 5000:
            raise ValueError('Il commento deve avere tra 1 e 5.000 caratteri')
        return v


class CommentResponse(BaseModel):
    id: int
    content_id: int
    author: str
    text: str
    created_at: datetime

    class Config:
        from_attributes = True
