# POST /query — search the knowledge base
# TODO: implement query route

from typing import BinaryIO

from fastapi import APIRouter,File,UploadFile,Depends

from ...services.document_service import store_pdf as _store_pdf,store_documents as _store_documents


documents_router = APIRouter()




@documents_router.post("/savetext")
def store_documents(documents: list[str]):
    _store_documents(documents)



@documents_router.post("/uploadfile")
def store_pdf(file:UploadFile):
    _store_pdf(file)
   



