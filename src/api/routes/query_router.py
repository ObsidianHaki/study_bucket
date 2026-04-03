from fastapi import APIRouter
from ...services.query_service import query

query_router = APIRouter(tags=["query"])


@query_router.post("/query",tags=["query"])
async def send_query(question: str, session_id: str = None):
    return await query(question, session_id)