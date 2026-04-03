from ..db.vector_db.chroma_client import get_collection
from ..ai.anthropic_llm import get_llm_response
from .chat_history_service import create_session, add_message, get_session

collection = get_collection()


async def query(question: str, session_id: str = None) -> dict:
    if session_id is None:
        session_id = create_session(question)

    add_message(session_id, "user", question)

    results = collection.query(query_texts=[question], n_results=5)
    documents = results["documents"][0]

    context = "\n\n".join(documents)
    metadatas = "\n\n".join(str(metadata) for metadata in results["metadatas"][0])

    session = get_session(session_id)
    previous_message = session["messages"][-6:] if session and session.get("messages") else []

    prompt = f"""
    You are a helpful assistant that answers questions based strictly on the provided context.

    ### Rules:
    1. **Source Check**: Analyze the provided context to see if it contains the answer to the user's question.
    2. **Strict Adherence**: If the answer is not present in the context, do not use outside knowledge.
    3. **Refusal Protocol**: If you cannot find the answer, respond exactly with: "I'm sorry, but I don't have enough information in the uploaded documents to answer that. Please upload more relevant data so I can assist you better."
    4. **Citations**: (Optional) If you find the answer, mention which part of the context it came from.
    5. **History**: Use the chat history to give the user proper answers based on passed information.
    6. **Metadatas**: Provides information about the source of the data and the referenced page number. Consider to tell the user where the source information is coming from.

    ### Chat History:
    {previous_message}

    ### Metadata:
    {metadatas}


    ### Context:
    {context}

    ### Question:
    {question}


    """
    llm_response = await get_llm_response(prompt)

    add_message(session_id, "assistant", llm_response)
    return {"session_id": session_id, "response": llm_response}