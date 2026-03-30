from fastapi import APIRouter
from ...services.chat_history_service import get_all_sessions, get_session, delete_session

chat_router = APIRouter(prefix="/sessions", tags=["sessions"])


@chat_router.get("")
def list_sessions():
    return get_all_sessions()


@chat_router.get("/{session_id}")
def get_chat_session(session_id: str):
    session = get_session(session_id)
    if session is None:
        return {"error": "Session not found"}
    return session


@chat_router.delete("/{session_id}")
def delete_chat_session(session_id: str):
    delete_session(session_id)
    return {"status": "deleted"}
