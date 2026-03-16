import chromadb
from ..config import COLLECTION_NAME
from .client import create_client
client=create_client()

def get_or_create_collection():
    return client.get_or_create_collection(
         name=COLLECTION_NAME
    )
