import chromadb
from chromadb import Collection
from ..constants import  VECTOR_DATABASE,REGISTRY_COLLECTION

chroma_client = chromadb.PersistentClient(VECTOR_DATABASE)

def get_collection() -> Collection:
    return chroma_client.get_or_create_collection(name=REGISTRY_COLLECTION)
