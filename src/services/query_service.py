# services/query_service.py — like a @Service in Spring Boot

from chromadb import Collection
from fastapi import Depends

from ..db.chroma_client import get_collection


def get_query_service(collection: Collection = Depends(get_collection)):
    """
    Same pattern as document_service: Depends injects the collection.

    IMPORTANT: Depends() only works in FastAPI route function parameters,
    or in other functions that are themselves used with Depends().
    You can NOT use Depends() inside a regular function call — that's
    the mistake you had before.
    """
    class QueryService:
        def query(self, queries: list[str]):
            return collection.query(query_texts=queries, n_results=2)

    return QueryService()
