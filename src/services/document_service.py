import hashlib
import logging
from gridfs import GridFSBucket
from fastapi import UploadFile, BackgroundTasks
from ..util.file_parser import parse_pdf
from ..db.vector_db.chroma_client import get_collection
from ..db.mongo_db.mongo_client import MONGO_CLIENT
from ..db.constants import CHUNKS_COLLECTION

logger = logging.getLogger(__name__)

chunks_collection = MONGO_CLIENT.get_collection(CHUNKS_COLLECTION)
collection = get_collection()
gridfs_bucket = GridFSBucket(MONGO_CLIENT, bucket_name="knowledge_pool")

CHROMA_BATCH_SIZE = 100


def validate_file_exists_in_collection(file_name: str) -> bool:
    """Check GridFS only - single source of truth for file existence."""
    return (
        MONGO_CLIENT["knowledge_pool.files"].find_one({"filename": file_name})
        is not None
    )


def get_all_documents():
    """Get all filenames from GridFS (single source of truth)."""
    files_cursor = MONGO_CLIENT["knowledge_pool.files"].find({}, {"filename": 1})
    return [file["filename"] for file in files_cursor]


def _build_chunk_ids(chunks: list[dict]) -> list[str]:
    return [
        hashlib.sha256(
            f"{item['chunked_text']}:{item['metadata']['Page']}:{i}".encode()
        ).hexdigest()
        for i, item in enumerate(chunks)
    ]


def _store_chunks(chunks: list[dict], filename: str):
    ids = _build_chunk_ids(chunks)
    documents = [item["chunked_text"] for item in chunks]
    # Add filename to each chunk's metadata so it's available in query results
    metadatas = [{**item["metadata"], "filename": filename} for item in chunks]

    # Persist chunk data in MongoDB for reindexing capability
    chunks_collection.insert_one(
        {
            "filename": filename,
            "chunk_count": len(chunks),
            "chunks": [
                {
                    "id": ids[i],
                    "text": item["chunked_text"],
                    "metadata": item["metadata"],
                }
                for i, item in enumerate(chunks)
            ],
        }
    )
    logger.info("Chunks saved | filename='%s' | chunks=%d", filename, len(chunks))

    # Store in ChromaDB (slow — embedding step)
    for start in range(0, len(ids), CHROMA_BATCH_SIZE):
        end = start + CHROMA_BATCH_SIZE
        collection.add(
            ids=ids[start:end],
            documents=documents[start:end],
            metadatas=metadatas[start:end],
        )
    logger.info("ChromaDB indexed | filename='%s' | chunks=%d", filename, len(chunks))


def save_document(file: UploadFile, background_tasks: BackgroundTasks):
    filename = file.filename or "untitled.pdf"

    if validate_file_exists_in_collection(filename):
        return None

    # Store original PDF in MongoDB GridFS (knowledge_pool bucket)
    file.file.seek(0)
    pdf_bytes = file.file.read()
    gridfs_bucket.upload_from_stream(
        filename, pdf_bytes, metadata={"content_type": "application/pdf"}
    )
    logger.info(
        "PDF stored in GridFS | filename='%s' | size=%d bytes", filename, len(pdf_bytes)
    )

    file.file.seek(0)
    logger.info("Saving document | filename='%s'", filename)
    chunks = parse_pdf(file.file, filename=filename)
    logger.info("Chunking complete | filename='%s' | chunks=%d", filename, len(chunks))

    background_tasks.add_task(_store_chunks, chunks, filename)

    return {"filename": filename, "chunks": len(chunks), "status": "processing"}


def get_pdf_from_mongo(filename: str) -> bytes | None:
    """Retrieve PDF bytes from GridFS by filename."""
    grid_out = gridfs_bucket.find({"filename": filename}).sort("uploadDate", -1)
    try:
        file = next(grid_out)
        return file.read()
    except StopIteration:
        return None


def reindex_from_mongo() -> dict:
    """Rebuild ChromaDB from chunks stored in MongoDB. No PDFs needed."""
    docs = list(chunks_collection.find({"chunks": {"$exists": True}}))
    total_chunks = 0

    for doc in docs:
        chunks = doc["chunks"]
        ids = [c["id"] for c in chunks]
        documents = [c["text"] for c in chunks]
        metadatas = [{**c["metadata"], "filename": doc["filename"]} for c in chunks]

        for start in range(0, len(ids), CHROMA_BATCH_SIZE):
            end = start + CHROMA_BATCH_SIZE
            collection.add(
                ids=ids[start:end],
                documents=documents[start:end],
                metadatas=metadatas[start:end],
            )
        total_chunks += len(chunks)
        logger.info(
            "Re-indexed | filename='%s' | chunks=%d", doc["filename"], len(chunks)
        )

    return {"documents": len(docs), "chunks": total_chunks}
