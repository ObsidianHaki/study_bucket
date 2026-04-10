import json
from collections.abc import AsyncGenerator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from ...services.query_service import query

query_router = APIRouter(tags=["query"])


async def _event_stream(session_id: str, token_gen: AsyncGenerator[str | dict, None]):
    # First event: send the session_id so the frontend can track it
    yield f"data: {json.dumps({'type': 'session', 'session_id': session_id})}\n\n"

    async for token in token_gen:
        if isinstance(token, dict):
            yield f"data: {json.dumps({'type': 'meta', **token})}\n\n"
        else:
            yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"

    yield f"data: {json.dumps({'type': 'done'})}\n\n"


@query_router.post("/query", tags=["query"])
async def send_query(question: str, session_id: str = None):
    result = await query(question, session_id)
    return StreamingResponse(
        _event_stream(result["session_id"], result["stream"]),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )