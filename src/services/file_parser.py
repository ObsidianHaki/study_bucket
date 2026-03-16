from typing import BinaryIO

from pypdf import PdfReader

def parse_pdf(file_strean:BinaryIO) :
    reader=PdfReader(file_strean)
    return [page.extract_text() for page in reader.pages]


