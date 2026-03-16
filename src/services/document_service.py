import hashlib
from typing import Collection
from ..db.collection import get_or_create_collection

collection=get_or_create_collection()

def store_documents (documents:list[str]):
    for document in documents:
        collection.add(
        ids=hashlib.sha256(document.encode()).hexdigest(),
        documents= document
    )
