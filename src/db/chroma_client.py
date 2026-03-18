import chromadb
from chromadb import Collection

# create client

client=chromadb.PersistentClient()


def get_collection() -> Collection:
   
    return client.get_or_create_collection(name="Knowledge_Base")

