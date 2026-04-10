from typing import BinaryIO

from pypdf import PdfReader
from .text_chunker import splitter


def parse_pdf(binary_stream: BinaryIO, filename: str = None) -> list[dict]:
    reader = PdfReader(binary_stream)
    meta = reader.metadata
    title = str(meta.title) if meta.title else None
    if not title or title.strip() in ("", "No Title", "untitled"):
        title = filename.rsplit(".", 1)[0] if filename else "Untitled"
    base_metadata = {
        "Title": title,
        "Author": str(meta.author) if meta.author else "No Author",
    }

    complete_chunks = []
    for page_number, page in enumerate(reader.pages, start=1):
        text = page.extract_text()
        if not text:
            continue
        chunks = splitter.split_text(text)
        for chunk in chunks:
            complete_chunks.append(
                {"chunked_text": chunk,
                 "metadata": {**base_metadata, "Page": page_number}}
            )

    return complete_chunks
