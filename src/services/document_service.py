import hashlib
import logging
from chromadb import Collection
from fastapi import Depends, UploadFile

from ..util.file_parser import parse_pdf
from ..db.vector_db.chroma_client import get_collection
from ..db.mongo_db.mongo_client import get_client_db, REGISTRY_COLLECTION
from ..util.cursor import get_pdf_entries

logger = logging.getLogger(__name__)

db = get_client_db().get_collection(REGISTRY_COLLECTION)


def validate_file_exists_in_collection(file_name: str):
    print(file_name)
    if db.find_one({"filename": file_name}):  # 1st arg=filtering
        return True
    return False


def get_all_documents():
    cursor = db.find()
    return get_pdf_entries(cursor)


def save_document(file: UploadFile, collection: Collection):
    if validate_file_exists_in_collection(str(file.filename)):
        return

    logger.info("PDF upload received | filename='%s' | content_type='%s'", file.filename, file.content_type)
    chunks = parse_pdf(file.file)
    logger.info("PDF parsed into %d chunk(s) | filename='%s'", len(chunks), file.filename)
    ids = [
        hashlib.sha256(f"{item['chunked_text']}:{item['metadata']['Page']}:{i}".encode()).hexdigest()
        # TODO: Check if this strategy is sustainable
        for i, item in enumerate(chunks)
    ]
    documents = [item["chunked_text"] for item in chunks]
    metadatas = [item["metadata"] for item in chunks]

    collection.add(ids=ids, documents=documents, metadatas=metadatas)
    logger.info("PDF stored in ChromaDB | filename='%s' | chunks=%d", file.filename, len(chunks))
    db.insert_one({"filename": file.filename})
    logger.info(f"File {str(file.filename)} stored.")


def get_document_service(collection: Collection = Depends(get_collection)):
    class DocumentService:
        def save_document(self, file: UploadFile):
            save_document(file, collection)

        def get_documents(self):
            return get_all_documents()

    return DocumentService()
