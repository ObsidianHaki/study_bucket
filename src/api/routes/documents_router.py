from io import BytesIO
from fastapi import APIRouter, UploadFile, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse
from ...services.document_service import save_document, get_all_documents, get_pdf_from_mongo, reindex_from_mongo

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


@documents_router.get("/download/{filename:path}")
def download_document(filename: str):
    pdf_bytes = get_pdf_from_mongo(filename)
    if pdf_bytes is None:
        raise HTTPException(status_code=404, detail="File not found")
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@documents_router.post("/reindex")
def reindex_documents():
    """Rebuild ChromaDB from chunks stored in MongoDB."""
    result = reindex_from_mongo()
    return {"status": "ok", **result}
