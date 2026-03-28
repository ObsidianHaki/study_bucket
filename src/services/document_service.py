import hashlib
import logging
from chromadb import Collection
from fastapi import Depends, UploadFile


from ..util.file_parser import parse_pdf
from ..db.vector_db.chroma_client import get_collection

logger = logging.getLogger(__name__)


def store_documents(documents: list[str], collection: Collection):
    logger.info("Storing %d text document(s) to ChromaDB", len(documents))
    for document in documents:
        collection.add(
            ids=[hashlib.sha256(document.encode()).hexdigest()], documents=[document]
        )
    logger.info("Successfully stored %d text document(s)", len(documents))


def store_pdf(file: UploadFile, collection: Collection):
    logger.info("PDF upload received | filename='%s' | content_type='%s'", file.filename, file.content_type)
    chunks = parse_pdf(file.file)
    logger.info("PDF parsed into %d chunk(s) | filename='%s'", len(chunks), file.filename)
    ids = [
        hashlib.sha256(f"{item['chunked_text']}:{item['metadata']['Page']}:{i}".encode()).hexdigest()#TODO: Check if this strategy is sustainable
        for i, item in enumerate(chunks)
    ]
    documents = [item["chunked_text"] for item in chunks]
    metadatas = [item["metadata"] for item in chunks]

    collection.add(ids=ids, documents=documents, metadatas=metadatas)
    logger.info("PDF stored in ChromaDB | filename='%s' | chunks=%d", file.filename, len(chunks))


def get_document_service(collection: Collection = Depends(get_collection)):

    class DocumentService:
        def store_documents(self, documents: list[str]):
            store_documents(documents, collection)

        def store_pdf(self, file: UploadFile):
            store_pdf(file, collection)

    return DocumentService()
