import hashlib
import logging
from fastapi import UploadFile, BackgroundTasks
from ..util.file_parser import parse_pdf
from ..db.vector_db.chroma_client import get_collection
from ..db.mongo_db.mongo_client import MONGO_CLIENT
from ..db.constants import REGISTRY_COLLECTION
from ..util.cursor import get_pdf_entries


logger = logging.getLogger(__name__)

registry = MONGO_CLIENT.get_collection(REGISTRY_COLLECTION)
collection = get_collection()

CHROMA_BATCH_SIZE = 100


def validate_file_exists_in_collection(file_name: str) -> bool:
    return registry.find_one({"filename": file_name}) is not None


def get_all_documents():
    registry_cursor = registry.find()
    return get_pdf_entries(registry_cursor)


def _store_chunks(chunks: list[dict], filename: str):
    ids = [
        hashlib.sha256(f"{item['chunked_text']}:{item['metadata']['Page']}:{i}".encode()).hexdigest()
        for i, item in enumerate(chunks)
    ]
    documents = [item["chunked_text"] for item in chunks]
    metadatas = [item["metadata"] for item in chunks]

    for start in range(0, len(ids), CHROMA_BATCH_SIZE):
        end = start + CHROMA_BATCH_SIZE
        collection.add(
            ids=ids[start:end],
            documents=documents[start:end],
            metadatas=metadatas[start:end],
        )

    registry.insert_one({"filename": filename})
    logger.info("Document uploaded | filename='%s' | chunks=%d", filename, len(chunks))


def save_document(file: UploadFile, background_tasks: BackgroundTasks):
    filename = file.filename or "untitled.pdf"

    if validate_file_exists_in_collection(filename):
        return None

    logger.info("Saving document | filename='%s'", filename)
    chunks = parse_pdf(file.file)
    logger.info("Chunking complete | filename='%s' | chunks=%d", filename, len(chunks))

    background_tasks.add_task(_store_chunks, chunks, filename)

    return {"filename": filename, "chunks": len(chunks), "status": "processing"}