import chromadb
from chromadb import Collection

client = chromadb.PersistentClient("/chroma") #TODO: use "/" only  for Docker containerization

def get_collection() -> Collection:
    return client.get_or_create_collection(name="Knowledge_Base")
