from fastapi import APIRouter, UploadFile, Depends
from ...services.document_service import get_document_service

documents_router = APIRouter()

@documents_router.post("/uploadfile")
def store_pdf(file: UploadFile, service=Depends(get_document_service)):
    service.store_pdf(file)
