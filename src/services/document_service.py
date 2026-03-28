# services/document_service.py — like a @Service class in Spring Boot
import hashlib
from pydoc import get_pager

from chromadb import Collection
from fastapi import Depends, UploadFile
from rich import text

from ..util.file_parser import parse_pdf
from ..db.vector_db.chroma_client import get_collection


def store_documents(documents: list[str], collection: Collection):
    for document in documents:
        collection.add(
            ids=[hashlib.sha256(document.encode()).hexdigest()],
            documents=[document]
        )


def store_pdf(file: UploadFile, collection: Collection):
    chunks = parse_pdf(file.file)

    for item in chunks:
        text_chunk = item["chunked_text"]
        metadata = item["metadata"]
        collection.add(
            ids=[hashlib.sha256(text_chunk.encode()).hexdigest()],
            documents=[text_chunk],
            metadatas=[metadata]
        )
        # Previous
    # for chunk in chunks: # currently chunk is the text, later it wiill be a dict, where I need to extract the text
    #     collection.add(
    #         ids=[hashlib.sha256(chunk.encode()).hexdigest()],
    #         documents=[chunk.],
    #         metadatas=[{"source": file.filename}]
    #     )


def get_document_service(collection: Collection = Depends(get_collection)):
    """
    This is the DI "glue". Think of it like a @Bean that wires the collection
    into your service methods, so routes don't need to know about the collection.

    In Spring Boot you'd do:
        @Service
        class DocumentService {
            @Autowired Collection collection;
        }

    In FastAPI, Depends(get_collection) does the @Autowired part.
    """
    class DocumentService:
        def store_documents(self, documents: list[str]):
            store_documents(documents, collection)

        def store_pdf(self, file: UploadFile):
            store_pdf(file, collection)

    return DocumentService()
