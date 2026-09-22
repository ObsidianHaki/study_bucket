import time
from collections.abc import AsyncGenerator

from ..db.vector_db.chroma_client import get_collection
from ..ai.anthropic_llm import stream_llm_response
from .chat_history_service import (
    create_session,
    add_message,
    get_session,
    set_session_documents,
)

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
Wrap them in a fenced code block with language `mermaid`.

For `graph TD` and `flowchart` ONLY: add `style` lines to color nodes for visual hierarchy:
- `style NodeId fill:#color,stroke:#darker,color:#fff` — always use `color:#fff` for text
- Colors: `#7c3aed` (purple), `#6366f1` (indigo), `#3b82f6` (blue), `#0891b2` (cyan), `#059669` (green), `#d97706` (amber), `#dc2626` (red), `#db2777` (pink)

IMPORTANT: Do NOT add `style` lines to sequenceDiagram, classDiagram, stateDiagram, mindmap, timeline, or pie charts — they do not support it and will cause errors.
Examples:
- `graph TD` for flowcharts and architectures
- `sequenceDiagram` for interactions and protocols
- `classDiagram` for class relationships
- `mindmap` for concept overviews
- `stateDiagram-v2` for state machines
- `timeline` for chronological events

**HTML visualizations** — Use for anything that benefits from interactivity, color-coded layouts, styled cards, comparison tables, or anything that mermaid cannot represent well.
Wrap them in a fenced code block with language `html`. You can use inline CSS and JavaScript.
Use a dark theme (background: #09090b, text: #fafafa, accent: #7c3aed) to match the app.

Always combine your visualization with a text explanation. Use visualizations generously — they make learning much easier. Prefer mermaid for structural/flow content and HTML for rich, interactive, or styled content.

### Teaching Style:
You are a study companion. Structure your answers to maximize learning:
1. **Start with a brief overview** — 1-2 sentences explaining the concept at a high level.
2. **Use markdown tables** to summarize and compare things. Tables are great for:
   - Listing properties/attributes with descriptions
   - Comparing options, tools, or approaches side by side
   - Showing parameters, flags, or configuration options with their purpose and defaults
   - Providing quick-reference cheat sheets
3. **Use bullet points** for listing steps, features, or key takeaways.
4. **Include a diagram** (mermaid or HTML) whenever the concept involves relationships, flows, or architecture.
5. **Add a code example** when the concept involves code, config, or commands.
6. **End with key takeaways** — a short "Remember" or "Key points" section with the most important things to remember.

Format tables in markdown like:
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| value    | value    | value    |

### Code & File Content:
When showing file content, scripts, code examples, or configuration files, ALWAYS present them as proper fenced code blocks with the correct language identifier. This enables syntax highlighting that makes code look like a real editor.

Rules:
- Always use the correct language tag: ```python, ```bash, ```java, ```javascript, ```yaml, ```json, ```xml, ```sql, ```dockerfile, ```properties, ```toml, ```ini, ```css, ```html, ```go, ```rust, ```c, ```cpp, ```typescript, etc.
- Before the code block, mention the filename or path if known (e.g. **`application.yml`** or **`src/main/java/App.java`**).
- Show the complete file or relevant section — don't truncate unless the user asks for a summary.
- Add brief inline comments to explain key lines when helpful for learning.
- For shell commands, use ```bash and include comments explaining each step."""


def _build_documents_filter(documents: list[str]) -> dict | None:
    """Chroma `where` filter restricting retrieval to the given filenames. None = no filter."""
    if not documents:
        return None
    if len(documents) == 1:
        return {"filename": documents[0]}
    return {"filename": {"$in": documents}}


async def query(
    question: str,
    session_id: str | None = None,
    model: str | None = None,
    documents: list[str] | None = None,
) -> dict:
    """Prepare context and return session_id + streaming generator + retrieval metadata.

    `documents` scopes retrieval to those filenames and is persisted on the session;
    None or empty means search across all documents.
    """
    documents = documents or []
    if session_id is None:
        session_id = create_session(question, documents)
    else:
        set_session_documents(session_id, documents)

    add_message(session_id, "user", question)

    t_retrieval_start = time.perf_counter()
    results = collection.query(
        query_texts=[question],
        n_results=5,
        where=_build_documents_filter(documents),
    )
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
        async for token in stream_llm_response(SYSTEM_PROMPT, user_prompt, model):
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
            "documents_scope": documents,
            **llm_meta,
        }
        # Persist the complete response + metadata
        add_message(session_id, "assistant", "".join(full_response), meta=meta)
        # Yield final metadata dict to frontend
        yield {"_meta": True, **meta}

    return {"session_id": session_id, "stream": token_stream()}
