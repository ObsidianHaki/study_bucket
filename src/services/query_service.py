import chromadb

from ..db.collection import get_or_create_collection

def query(queries:list[str]):
    return get_or_create_collection().query(
        query_texts=queries,
        n_results=2
    )
