# services/query_service.py — like a @Service in Spring Boot

from chromadb import Collection
from fastapi import Depends
from sympy import Q, im

from ..db.vector_db.chroma_client import get_collection
from ..ai.anthropic_agent import get_anthropic_agent
from ..db.redis_db.redis_caching import save_query_and_response, get_previous_messages


def get_query_service(
    collection: Collection = Depends(get_collection), agent=Depends(get_anthropic_agent)
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
            # Step 2: Build a prompt with the retrieved context

            context = "\n\n".join(documents)

            previous_message = get_previous_messages()

            prompt = f"""
            You are a helpful assistant that answers questions based strictly on the provided context.

            ### Rules:
            1. **Source Check**: Analyze the provided context to see if it contains the answer to the user's question.
            2. **Strict Adherence**: If the answer is not present in the context, do not use outside knowledge. 
            3. **Refusal Protocol**: If you cannot find the answer, respond exactly with: "I'm sorry, but I don't have enough information in the uploaded documents to answer that. Please upload more relevant data so I can assist you better."
            4. **Citations**: (Optional) If you find the answer, mention which part of the context it came from.
            5. **Hisotry**: Use the chat history to give the user proper answers based on passed infromations.

            ### Chat History:
            {previous_message}
        

            ### Context:
            {context}

            ### Question:
            {question}


            """
            llm_response = agent.generate(prompt)
            save_query_and_response(query=question, response=llm_response)
            return llm_response

    return QueryService()
