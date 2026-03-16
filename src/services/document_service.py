import hashlib
from typing import BinaryIO, Collection

from fastapi import UploadFile
from ..db.collection import get_or_create_collection
from .file_parser import parse_pdf

collection=get_or_create_collection()

def store_documents (documents:list[str]):
    for document in documents:
        collection.add(
        ids=hashlib.sha256(document.encode()).hexdigest(),
        documents= document
    )

def store_pdf(documents_binary:UploadFile):
     documents=parse_pdf(documents_binary.file)
     for document in documents:
        collection.add(
        ids=hashlib.sha256(document.encode()).hexdigest(),
        documents= document
    )
