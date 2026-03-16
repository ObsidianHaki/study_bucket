from fastapi import APIRouter
query_router=APIRouter()
from ...services.query_service import query

@query_router.post("/sendquery")
def send_query(question: list[str]):
    return query(question)["documents"]
