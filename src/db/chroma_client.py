import chromadb
from chromadb import Collection

# create client

client=chromadb.PersistentClient()


def get_collection() -> Collection:
    """
    This is like:
        @Bean
        public Collection collection() { return client.getOrCreateCollection(...); }

    FastAPI will call this function every time a route needs a Collection.
    """
    return client.get_or_create_collection(name="Knowledge_Base")

