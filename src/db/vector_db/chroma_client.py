import chromadb
from chromadb import Collection
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
from ..constants import VECTOR_DATABASE, CHROMA_COLLECTION

chroma_client = chromadb.PersistentClient(VECTOR_DATABASE)

embedding_fn = SentenceTransformerEmbeddingFunction(
    model_name="nomic-ai/nomic-embed-text-v1.5",
    trust_remote_code=True,
)


def get_collection() -> Collection:
    return chroma_client.get_or_create_collection(
        name=CHROMA_COLLECTION,
        embedding_function=embedding_fn,
        metadata={"hnsw:space": "cosine"},
    )
