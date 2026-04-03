from fastapi import APIRouter, UploadFile, BackgroundTasks, HTTPException
from ...services.document_service import save_document, get_all_documents

documents_router = APIRouter(prefix="/documents", tags=["documents"])


@documents_router.post("/upload", tags=["documents"])
def upload_document(file: UploadFile, background_tasks: BackgroundTasks):
    result = save_document(file, background_tasks)
    if result is None:
        raise HTTPException(status_code=409, detail=f"File '{file.filename}' already exists")
    return result


@documents_router.get("/all")
def list_documents():
    return get_all_documents()