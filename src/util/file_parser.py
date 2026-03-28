import logging
from typing import BinaryIO

from pypdf import PdfReader
from .text_chunker import splitter

logger = logging.getLogger(__name__)


def get_pdf_metadata(binary_stream: BinaryIO,page_number: int) -> dict:
    binary_stream.seek(0)
    reader = PdfReader(binary_stream)
    meta = reader.metadata
    return {
        "Title": meta.title,
        "Author": meta.author,
        "Page": page_number
        # "Subject": meta.subject,
        # "Creator": meta.creator,
        # "Producer": meta.producer,
        # "Total Pages": len(reader.pages)
    }

def parse_pdf(binary_stream: BinaryIO) -> list[dict]:
    reader = PdfReader(binary_stream)
    meta = reader.metadata
    base_metadata = {
        "Title": meta.title,
        "Author": meta.author,
    }
    logger.info("Parsing PDF | title='%s' | author='%s' | pages=%d", meta.title, meta.author, len(reader.pages))

    complete_chunks = []
    for page_number, page in enumerate(reader.pages, start=1):
        text = page.extract_text()
        if not text:
            logger.warning("Page %d has no extractable text, skipping", page_number)
            continue
        chunks = splitter.split_text(text)
        for chunk in chunks:
            complete_chunks.append(
                {"chunked_text": chunk,
                 "metadata": {**base_metadata, "Page": page_number}}
            )

    logger.info("PDF parsing complete | total_chunks=%d", len(complete_chunks))
    return complete_chunks
