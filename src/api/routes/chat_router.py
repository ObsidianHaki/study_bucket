from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ...services.chat_history_service import get_all_sessions, get_session, delete_session, rename_session, set_session_documents

chat_router = APIRouter(prefix="/sessions", tags=["sessions"])


class RenameSession(BaseModel):
    title: str


class SessionDocuments(BaseModel):
    documents: list[str]


@chat_router.get("")
def list_sessions():
    return get_all_sessions()


@chat_router.get("/{session_id}")
def get_chat_session(session_id: str):
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@chat_router.patch("/{session_id}")
def rename_chat_session(session_id: str, body: RenameSession):
    if not rename_session(session_id, body.title):
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "updated"}


@chat_router.put("/{session_id}/documents")
def set_chat_session_documents(session_id: str, body: SessionDocuments):
    """Scope a chat's retrieval to specific documents. Empty list = all documents."""
    if not set_session_documents(session_id, body.documents):
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "updated", "documents": body.documents}


@chat_router.delete("/{session_id}")
def delete_chat_session(session_id: str):
    delete_session(session_id)
    return {"status": "deleted"}
