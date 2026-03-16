# POST /query — search the knowledge base
# TODO: implement query route

from fastapi import APIRouter
from ...services.document_service import store_documents as _store_documents

documents_router = APIRouter()

@documents_router.post("/savedocument")
def store_documents(documents: list[str]):
    _store_documents(documents)