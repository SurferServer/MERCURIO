from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Comment, Content
from ..schemas import CommentCreate, CommentResponse
from ..auth import get_current_user, require_editor, CurrentUser

router = APIRouter(prefix="/api/contents", tags=["comments"])


@router.get("/{content_id}/comments", response_model=list[CommentResponse])
def get_comments(
    content_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    content = db.query(Content).filter(Content.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="Contenuto non trovato")
    return db.query(Comment).filter(Comment.content_id == content_id).order_by(Comment.created_at.asc()).all()


@router.post("/{content_id}/comments", response_model=CommentResponse, status_code=201)
def add_comment(
    content_id: int,
    data: CommentCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_editor),
):
    """Only admin and collaborators can comment."""
    content = db.query(Content).filter(Content.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="Contenuto non trovato")
    # Use the authenticated user's name, not whatever the client sends
    comment = Comment(content_id=content_id, author=user.name, text=data.text)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment
