from fastapi import APIRouter, Depends
from ...services.query_service import get_query_service

query_router = APIRouter()


@query_router.post("/query")
def send_query(question: str, session_id: str = None, service=Depends(get_query_service)):
    return service.query(question, session_id)
