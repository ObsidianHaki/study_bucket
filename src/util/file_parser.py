from typing import BinaryIO

from pypdf import PdfReader
from .text_chunker import splitter

def parse_pdf(file_stream: BinaryIO) -> list[str]:
    reader = PdfReader(file_stream)
    chunks = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            chunks.extend(splitter.split_text(text))
    return chunks
