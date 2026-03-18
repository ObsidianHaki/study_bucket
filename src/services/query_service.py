# services/query_service.py — like a @Service in Spring Boot

from chromadb import Collection
from fastapi import Depends

from ..db.chroma_client import get_collection
from ..ai.anthropic_agent import get_anthropic_agent


def get_query_service(
    collection: Collection = Depends(get_collection),
    agent=Depends(get_anthropic_agent)
):
    """
    Depends injects both the ChromaDB collection AND the GeminiAgent.

    This is like Spring Boot constructor injection:
        @Service
        public QueryService(Collection collection, GeminiAgent agent) { ... }
    """
    class QueryService:
        def query(self, question: str) -> str:
            # Step 1: Retrieve relevant documents from ChromaDB
            results = collection.query(query_texts=[question], n_results=3)
            documents = results["documents"][0]  
            print(f"See content {documents}")

            # Step 2: Build a prompt with the retrieved context
            context = "\n\n".join(documents)
            prompt = (
                "Use the following context to answer the question. "
                "If the context doesn't contain enough information, say you have no ifnromation about that, so you wont respond.\n\n"
                f"--- Context ---\n{context}\n\n"
                f"--- Question ---\n{question}"
            )

            # Step 3: Send to anthropic and return the answer
            return agent.generate(prompt)

    return QueryService()
