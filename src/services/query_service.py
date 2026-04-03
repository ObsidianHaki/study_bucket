# services/query_service.py — like a @Service in Spring Boot

from chromadb import Collection
from fastapi import Depends
import logging

logger = logging.getLogger(__name__)

from ..db.vector_db.chroma_client import get_collection
from ..ai.anthropic_llm import get_anthropic_llm
from ..db.redis_db.redis_client import save_query_and_response, cache_previous_messages
from .chat_history_service import create_session, add_message


def get_query_service(
        collection: Collection = Depends(get_collection), agent=Depends(get_anthropic_llm)
):
    class QueryService:
        def query(self, question: str, session_id: str = None) -> dict:
            # If no session_id, create a new session
            if session_id is None:
                session_id = create_session(question)

            # Save user message to session
            add_message(session_id, "user", question)

            # Step 1: Retrieve relevant documents from ChromaDB
            results = collection.query(query_texts=[question], n_results=3)
            documents = results["documents"][0]
            # Step 2: Build a prompt with the retrieved context

            context = "\n\n".join(documents)
            metadatas = "\n\n".join(str(metadata) for metadata in results["metadatas"][0])

            previous_message = cache_previous_messages()

            prompt = f"""
            You are a helpful assistant that answers questions based strictly on the provided context.

            ### Rules:
            1. **Source Check**: Analyze the provided context to see if it contains the answer to the user's question.
            2. **Strict Adherence**: If the answer is not present in the context, do not use outside knowledge.
            3. **Refusal Protocol**: If you cannot find the answer, respond exactly with: "I'm sorry, but I don't have enough information in the uploaded documents to answer that. Please upload more relevant data so I can assist you better."
            4. **Citations**: (Optional) If you find the answer, mention which part of the context it came from.
            5. **Hisotry**: Use the chat history to give the user proper answers based on passed infromations.
            6. **Metadatas**: Provides information about the source of the data and the referenced page number. Consdier to tell the user where the source information is coming from.

            ### Chat History:
            {previous_message}

            ### Metadata:
            {metadatas}


            ### Context:
            {context}

            ### Question:
            {question}


            """
            logger.info("Prompt sent to LLM | question='%s' | context_docs=%d", question, len(documents))
            llm_response = agent.get_llm_response(prompt)
            logger.info("LLM response received | question='%s' | response_length=%d", question, len(llm_response))

            save_query_and_response(query=question, response=llm_response)  # redis

            # Save assistant message to session
            add_message(session_id, "assistant", llm_response)

            logger.info("Query and response cached in Redis | question='%s'", question)
            return {"session_id": session_id, "response": llm_response}

    return QueryService()
