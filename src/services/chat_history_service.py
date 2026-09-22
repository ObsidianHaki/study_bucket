import logging
from datetime import datetime, timezone
from bson import ObjectId
from ..db.mongo_db.mongo_client import  CHAT_SESSIONS_COLLECTION,MONGO_CLIENT

logger = logging.getLogger(__name__)

sessions = MONGO_CLIENT.get_collection(CHAT_SESSIONS_COLLECTION)


def create_session(first_message: str, documents: list[str] | None = None) -> str:
    """Create a new chat session. Returns the session_id as a string."""
    title = first_message[:50] + ("..." if len(first_message) > 50 else "")
    doc = {
        "title": title,
        "documents": documents or [],
        "messages": [],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    result = sessions.insert_one(doc)
    logger.info("Session created | session_id='%s'", result.inserted_id)
    return str(result.inserted_id)


def add_message(session_id: str, role: str, content: str, meta: dict | None = None):
    """Append a message to an existing session."""
    message = {
        "role": role,
        "content": content,
        "timestamp": datetime.now(timezone.utc),
    }
    if meta:
        message["meta"] = meta
    sessions.update_one(
        {"_id": ObjectId(session_id)},
        {
            "$push": {"messages": message},
            "$set": {"updated_at": datetime.now(timezone.utc)},
        },
    )


def get_session(session_id: str) -> dict | None:
    """Get a single session with all its messages."""
    doc = sessions.find_one({"_id": ObjectId(session_id)})
    if doc:
        doc["_id"] = str(doc["_id"])
        logger.info("Session found | session_id='%s'", session_id)
    else:
        logger.warning("Session not found | session_id='%s'", session_id)
    return doc


def get_all_sessions() -> list[dict]:
    """Return all sessions (without messages) sorted by most recent."""
    cursor = sessions.find(
        {},
        {"title": 1, "created_at": 1, "updated_at": 1},
    ).sort("updated_at", -1)
    result = []
    for doc in cursor:
        doc["_id"] = str(doc["_id"])
        result.append(doc)
    return result


def set_session_documents(session_id: str, documents: list[str]) -> bool:
    """Set the documents a session's retrieval is scoped to. Empty list = all documents."""
    result = sessions.update_one(
        {"_id": ObjectId(session_id)},
        {"$set": {"documents": documents}},
    )
    return result.matched_count > 0


def rename_session(session_id: str, new_title: str) -> bool:
    """Rename a chat session. Returns True if updated."""
    result = sessions.update_one(
        {"_id": ObjectId(session_id)},
        {"$set": {"title": new_title}},
    )
    return result.modified_count > 0


def delete_session(session_id: str):
    """Delete a chat session."""
    sessions.delete_one({"_id": ObjectId(session_id)})
