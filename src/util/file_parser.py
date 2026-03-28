from typing import BinaryIO

from pypdf import PdfReader
from .text_chunker import splitter


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

def parse_pdf(binary_stream: BinaryIO) -> list[str]:
    reader = PdfReader(binary_stream)
    
    complete_chunks = []
    page_counter=1
    for page in reader.pages:
        text = page.extract_text()
        chunks = []
        if text:
            chunks.extend(
                splitter.split_text(text)
            )  # create chunks for one complete page, extend splits those elements in a simple list
        for chunk in chunks:
            complete_chunks.append(
                {"chunked_text": chunk, 
                "metadata": get_pdf_metadata(binary_stream,page_counter)
                }
            )
        page_counter+=1
        

    return complete_chunks
