import time
from collections.abc import AsyncGenerator

from ..db.vector_db.chroma_client import get_collection
from ..ai.anthropic_llm import stream_llm_response
from .chat_history_service import create_session, add_message, get_session

collection = get_collection()

SYSTEM_PROMPT = """You are a helpful assistant that answers questions based strictly on the provided context.

### Rules:
1. **Source Check**: Analyze the provided context to see if it contains the answer to the user's question.
2. **Strict Adherence**: If the answer is not present in the context, do not use outside knowledge.
3. **Refusal Protocol**: If you cannot find the answer, respond exactly with: "I'm sorry, but I don't have enough information in the uploaded documents to answer that. Please upload more relevant data so I can assist you better."
4. **Citations**: (Optional) If you find the answer, mention which part of the context it came from.
5. **History**: Use the chat history to give the user proper answers based on passed information.
6. **Metadatas**: Provides information about the source of the data and the referenced page number. Consider to tell the user where the source information is coming from.

### Visualization:
When explaining concepts that benefit from visual representation, you MUST include visualizations using one of these formats:

**Mermaid diagrams** — Use for architectures, flows, hierarchies, relationships, timelines, and processes.
Wrap them in a fenced code block with language `mermaid`. Examples:
- `graph TD` for flowcharts and architectures
- `sequenceDiagram` for interactions and protocols
- `classDiagram` for class relationships
- `mindmap` for concept overviews
- `stateDiagram-v2` for state machines
- `timeline` for chronological events

**HTML visualizations** — Use for anything that benefits from interactivity, color-coded layouts, styled cards, comparison tables, or anything that mermaid cannot represent well.
Wrap them in a fenced code block with language `html`. You can use inline CSS and JavaScript.
Use a dark theme (background: #09090b, text: #fafafa, accent: #7c3aed) to match the app.

Always combine your visualization with a text explanation. Use visualizations generously — they make learning much easier. Prefer mermaid for structural/flow content and HTML for rich, interactive, or styled content."""


async def query(question: str, session_id: str = None) -> dict:
    """Prepare context and return session_id + streaming generator + retrieval metadata."""
    if session_id is None:
        session_id = create_session(question)

    add_message(session_id, "user", question)

    t_retrieval_start = time.perf_counter()
    results = collection.query(query_texts=[question], n_results=5)
    retrieval_ms = round((time.perf_counter() - t_retrieval_start) * 1000)

    documents = results["documents"][0]
    distances = results.get("distances", [[]])[0]
    raw_metadatas = results["metadatas"][0]

    # Build retrieval info for the frontend
    retrieved_chunks = []
    for i, doc in enumerate(documents):
        chunk_info = {
            "text": doc,
            "score": round(1 - distances[i], 3) if i < len(distances) else None,
            "metadata": raw_metadatas[i] if i < len(raw_metadatas) else {},
        }
        retrieved_chunks.append(chunk_info)

    context = "\n\n".join(documents)
    metadatas = "\n\n".join(str(metadata) for metadata in raw_metadatas)

    session = get_session(session_id)
    previous_message = (
        session["messages"][-6:] if session and session.get("messages") else []
    )

    user_prompt = f"""### Chat History:
{previous_message}

### Metadata:
{metadatas}

### Context:
{context}

### Question:
{question}"""

    async def token_stream() -> AsyncGenerator[str | dict, None]:
        full_response = []
        llm_meta = {}
        t_start = time.perf_counter()
        async for token in stream_llm_response(SYSTEM_PROMPT, user_prompt):
            if isinstance(token, dict):
                llm_meta = token
            else:
                full_response.append(token)
                yield token
        duration_ms = round((time.perf_counter() - t_start) * 1000)
        # Build metadata
        meta = {
            "retrieval_ms": retrieval_ms,
            "generation_ms": duration_ms,
            "total_ms": retrieval_ms + duration_ms,
            "chunks_retrieved": len(retrieved_chunks),
            "chunks": retrieved_chunks,
            **llm_meta,
        }
        # Persist the complete response + metadata
        add_message(session_id, "assistant", "".join(full_response), meta=meta)
        # Yield final metadata dict to frontend
        yield {"_meta": True, **meta}

    return {"session_id": session_id, "stream": token_stream()}
