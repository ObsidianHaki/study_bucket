from fastapi import APIRouter, UploadFile, Depends
from ...services.document_service import get_document_service

documents_router = APIRouter(prefix="/documents", tags=["documents"])


@documents_router.post("/upload", tags=["documents"])
def save_document(file: UploadFile, service=Depends(get_document_service)):
    service.save_document(file)

@documents_router.get("/all")
def get_all_documents(service=Depends(get_document_service)):
    return service.get_documents()



