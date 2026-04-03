import chromadb
from chromadb import Collection
from ..constants import  VECTOR_DATABASE,REGISTRY_COLLECTION

client = chromadb.PersistentClient(VECTOR_DATABASE)

def get_collection() -> Collection:
    return client.get_or_create_collection(name=REGISTRY_COLLECTION)
