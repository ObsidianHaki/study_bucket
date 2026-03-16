from fastapi import APIRouter, UploadFile, Depends

from ...services.document_service import get_document_service

documents_router = APIRouter()


# Depends(get_document_service) is like @Autowired DocumentService service
# FastAPI sees the Depends chain and automatically:
#   1. Calls get_collection() -> gets a Collection
#   2. Passes it into get_document_service() -> gets a DocumentService
#   3. Passes the DocumentService into your route as "service"

@documents_router.post("/savetext")
def store_documents(documents: list[str], service=Depends(get_document_service)):
    service.store_documents(documents)


@documents_router.post("/uploadfile")
def store_pdf(file: UploadFile, service=Depends(get_document_service)):
    service.store_pdf(file)
