# luni: AI Study Companion

luni is a self-hosted **Retrieval-Augmented Generation (RAG)** study assistant. Upload your PDFs (books, lecture notes, papers) and ask questions about them in a chat. luni finds the most relevant passages in your documents and has Claude (Anthropic's LLM) answer **only from that content**. It cites the book and page, and explains concepts with tables, Mermaid diagrams and interactive HTML visualizations.

## Features

- **PDF knowledge base**: upload PDFs; they are split into chunks, embedded and indexed for semantic search.
- **Grounded answers**: the LLM is instructed to answer strictly from the retrieved context and to refuse when the documents don't cover the question.
- **Source scoping per chat**: pick which books a chat may search ("All books", or any subset). The choice is saved with the chat.
- **Streaming responses**: answers stream token by token over Server-Sent Events (SSE).
- **Model selection**: switch between Claude models per message.
- **Transparency panel**: every answer shows the retrieved chunks with similarity scores, the books searched, token usage, estimated cost and latency.
- **Chat history & groups**: conversations are persisted; rename them, search them and organise them into groups.
- **PDF library**: browse and download every uploaded document.
- **Light/dark theme**, responsive layout for mobile.

---

## Architecture

```mermaid
graph TD
    subgraph Browser
        UI["Frontend<br/>(vanilla HTML/CSS/JS)"]
    end

    subgraph "luni container (FastAPI)"
        API["API routers<br/>documents · query · sessions · groups"]
        SVC["Services<br/>document · query · chat history · group"]
        EMB["Embedding model<br/>nomic-embed-text-v1.5"]
        LLM["Anthropic client<br/>(streaming)"]
    end

    subgraph Storage
        CHROMA[("ChromaDB<br/>vector index<br/>/chroma volume")]
        MONGO[("MongoDB<br/>GridFS PDFs · chunks<br/>chats · groups")]
    end

    CLAUDE["Anthropic API<br/>(Claude models)"]

    UI -- "REST + SSE" --> API
    API --> SVC
    SVC --> EMB
    EMB --> CHROMA
    SVC --> CHROMA
    SVC --> MONGO
    SVC --> LLM
    LLM -- "HTTPS, ANTHROPIC_API_KEY" --> CLAUDE

    style UI fill:#7c3aed,stroke:#5b21b6,color:#fff
    style API fill:#6366f1,stroke:#4338ca,color:#fff
    style SVC fill:#6366f1,stroke:#4338ca,color:#fff
    style EMB fill:#0891b2,stroke:#0e7490,color:#fff
    style LLM fill:#0891b2,stroke:#0e7490,color:#fff
    style CHROMA fill:#059669,stroke:#047857,color:#fff
    style MONGO fill:#059669,stroke:#047857,color:#fff
    style CLAUDE fill:#d97706,stroke:#b45309,color:#fff
```

| Component                                 | Responsibility                                                                                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend** (`frontend/`)                | Single-page app served by FastAPI at `/`. Chat UI, source picker, model picker, file upload, library, history sidebar. Renders Markdown, code, Mermaid and HTML visualizations. |
| **API layer** (`src/api/routes/`)         | FastAPI routers exposing the REST endpoints and the SSE query stream.                                                                                                           |
| **Services** (`src/services/`)            | Business logic: ingestion, retrieval + prompt building, chat persistence, groups.                                                                                               |
| **AI client** (`src/ai/anthropic_llm.py`) | Async Anthropic SDK client; streams tokens and returns usage metadata.                                                                                                          |
| **ChromaDB** (`src/db/vector_db/`)        | Persistent vector store (cosine similarity, HNSW) holding chunk embeddings plus metadata (`filename`, `Title`, `Author`, `Page`).                                               |
| **MongoDB** (`src/db/mongo_db/`)          | Original PDFs in GridFS (`knowledge_pool` bucket), raw chunks (so the vector index can be rebuilt without re-parsing), chat sessions and history groups.                        |

### Data model

| Store                  | Collection                         | Content                                                                                    |
| ---------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------ |
| MongoDB `study_bucket` | `knowledge_pool.files` / `.chunks` | Original PDF files (GridFS)                                                                |
|                        | `document_chunks`                  | Chunk text + metadata per file, used by `/documents/reindex`                               |
|                        | `chat_sessions`                    | `title`, `documents` (source scope, `[]` = all books), `messages[]` with per-answer `meta` |
|                        | `history_groups`                   | `name`, `chat_ids[]`                                                                       |
| ChromaDB `/chroma`     | `knowledge_pool`                   | Embeddings + chunk text + metadata                                                         |

---

## Flows

### 1. Document ingestion

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as FastAPI
    participant M as MongoDB
    participant C as ChromaDB

    U->>F: Drop a PDF
    F->>A: POST /documents/upload
    A->>M: Duplicate check (GridFS filename)
    A->>M: Store original PDF (GridFS)
    A->>A: Extract text per page (pypdf)<br/>Split into ~1000-char chunks, 100 overlap
    A-->>F: 200 {filename, chunks, status: "processing"}
    Note over A: Background task
    A->>M: Save raw chunks (document_chunks)
    A->>C: Embed (nomic-embed-text-v1.5) and index<br/>in batches of 100 with {filename, Title, Author, Page}
```

Embedding runs in a **background task**, so a freshly uploaded book becomes searchable a little after the upload request returns.

### 2. Asking a question (RAG query)

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as FastAPI
    participant C as ChromaDB
    participant M as MongoDB
    participant L as Anthropic API

    U->>F: Type question (optionally pick books + model)
    F->>A: POST /query?question=…&session_id=…&model=…&documents=…
    A->>M: Create session or update its source scope, save user message
    A->>C: Semantic search, top 5 chunks<br/>where filename ∈ selected books (if any)
    A->>M: Load last 6 messages (chat history)
    A->>L: Stream: system prompt + history + metadata + context + question
    A-->>F: SSE "session" event
    loop Streaming
        L-->>A: text delta
        A-->>F: SSE "token" event
    end
    A->>M: Save assistant message + meta (chunks, scores, usage, timings, scope)
    A-->>F: SSE "meta" event, then "done"
    F->>U: Rendered answer + transparency panel
```

**Source scoping:** when books are selected, retrieval uses a Chroma metadata filter (`{"filename": {"$in": [...]}}`), so only chunks from those books can reach the LLM. With no selection, all books are searched.

---

## Technologies

| Layer             | Technology                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------- |
| Language          | Python 3.14                                                                              |
| Web framework     | FastAPI, Uvicorn, Starlette `StaticFiles`                                                |
| LLM               | Anthropic Claude via the official `anthropic` Python SDK (async streaming)               |
| Embeddings        | `sentence-transformers` with `nomic-ai/nomic-embed-text-v1.5` (runs locally, no API key) |
| Vector database   | ChromaDB (persistent client, cosine distance)                                            |
| Document database | MongoDB 7 + GridFS, via `pymongo`                                                        |
| PDF parsing       | `pypdf`                                                                                  |
| Chunking          | LangChain `RecursiveCharacterTextSplitter` (1000 chars, 100 overlap)                     |
| Config            | `python-dotenv`                                                                          |
| Frontend          | Vanilla HTML/CSS/JavaScript (no build step)                                              |
| Frontend libs     | `marked` (Markdown), Prism.js (syntax highlighting), Mermaid 11 (diagrams)               |
| Packaging         | Docker, Docker Compose                                                                   |

---

## Configuration: environment variables

All configuration is read from a **`.env`** file at the project root. Docker Compose injects it into the container via `env_file`. It is listed in `.gitignore` and `.dockerignore`, so your secrets are never committed or baked into the image.

### Create the `.env` file

```bash
# .env
# --- LLM (Anthropic), required ---
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxx

# --- MongoDB ---
# "mongo" = Compose service name; use "localhost" when running the app outside Docker
MONGO_HOST=mongo
MONGO_PORT=27017
```

| Variable             | Required | Used by                           | Description                                                                                                                 |
| -------------------- | -------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`  | **Yes**  | `src/ai/anthropic_llm.py`         | API key sent with every request to the Anthropic API.                                                                       |
| `ANTHROPIC_BASE_URL` | No       | Anthropic SDK                     | Override the API endpoint, e.g. to route through a corporate proxy or LLM gateway. Defaults to `https://api.anthropic.com`. |
| `MONGO_HOST`         | Yes      | `src/db/mongo_db/mongo_client.py` | MongoDB hostname.                                                                                                           |
| `MONGO_PORT`         | Yes      | `src/db/mongo_db/mongo_client.py` | MongoDB port.                                                                                                               |

### Connecting to the LLM, step by step

1. **Get an API key.** Sign in to the [Claude Console](https://console.anthropic.com/), open **API Keys**, and create a key. It starts with `sk-ant-`. Make sure the workspace has billing/credits set up.
2. **Put it in `.env`** as `ANTHROPIC_API_KEY=sk-ant-...`. No quotes and no spaces around `=`.
3. **How it's wired:** `src/ai/anthropic_llm.py` calls `load_dotenv()` and then creates `anthropic.AsyncAnthropic()` with no arguments. The SDK automatically reads `ANTHROPIC_API_KEY` (and `ANTHROPIC_BASE_URL`, if set) from the environment, so no code change is needed.
4. **Restart the app** so the new environment is picked up. In Docker, `env_file` is read when the container is created:
   ```bash
   docker compose up -d --force-recreate luni
   ```
5. **Verify**: open the app, ask a question, and expand the info panel under the answer. It shows the model used and the token counts. A `401 authentication_error` in the container logs (`docker compose logs -f luni`) means the key is missing or wrong.

### Choosing / adding models

The model dropdown in the UI sends a model ID with each question. The backend only accepts IDs listed in `AVAILABLE_MODELS` in `src/ai/anthropic_llm.py`. Any unknown ID falls back to `DEFAULT_MODEL` (`claude-haiku-4-5-20251001`). To add a model:

1. Add its ID to `AVAILABLE_MODELS` in `src/ai/anthropic_llm.py`.
2. Add a matching `<option value="model-id">Label</option>` to `#modelSelector` in `frontend/index.html`.

`MAX_TOKENS` (default `4096`) in the same file caps the answer length.

---

## Getting started

### Prerequisites

- Docker + Docker Compose
- An Anthropic API key
- ~3 GB of disk for the image (CPU-only PyTorch, see below) plus ~550 MB for the embedding model, downloaded once on first start
- No GPU needed: the image installs the CPU build of PyTorch on purpose. The default PyPI build bundles ~5 GB of NVIDIA CUDA libraries that are never used without a GPU.

### Run with Docker (recommended)

```bash
git clone git@github.com:ObsidianHaki/study_bucket.git
cd study_bucket

# 1. Create .env (see "Configuration" above)
touch .env && $EDITOR .env

# 2. Build and start luni + MongoDB
docker compose up -d --build

# 3. Follow logs (first start downloads the embedding model)
docker compose logs -f luni
```

Open **http://localhost:8000**. The interactive API docs are at **http://localhost:8000/docs**.

Data is kept in three named volumes, which survive `docker compose down` (only `docker compose down -v` deletes them):

| Volume | Mounted at | Content |
|--------|-----------|---------|
| `chroma_docker` | `/chroma` | Vector index |
| `mongodb7_docker` | `/data/db` (mongo) | PDFs, chunks, chats, groups |
| `hf_models` | `/models` (`HF_HOME`) | Hugging Face embedding model cache (~524 MB), so the model is downloaded only once |

### Run locally (without Docker for the app)

```bash
# MongoDB still runs in Docker
docker compose up -d mongo

python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# In .env set MONGO_HOST=localhost
fastapi dev src/main.py
```

> **Note:** the Chroma path is hard-coded to `/chroma` in `src/db/constants.py` (`VECTOR_DATABASE`). For a local run, point it to a writable directory, e.g. `"./chroma"`, which is already git-ignored.

---

## API reference

| Method                   | Endpoint                               | Description                                                                                                                        |
| ------------------------ | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `POST`                   | `/documents/upload`                    | Upload a PDF (multipart `file`). `409` if the filename already exists.                                                             |
| `GET`                    | `/documents/all`                       | List uploaded filenames.                                                                                                           |
| `GET`                    | `/documents/download/{filename}`       | Download the original PDF.                                                                                                         |
| `POST`                   | `/documents/reindex`                   | Rebuild the Chroma index from chunks stored in MongoDB.                                                                            |
| `POST`                   | `/query`                               | Ask a question; returns an SSE stream. Query params: `question`, `session_id?`, `model?`, `documents?` (repeatable, one per book). |
| `GET`                    | `/models`                              | Allowed model IDs.                                                                                                                 |
| `GET`                    | `/sessions`                            | List chats (without messages).                                                                                                     |
| `GET`                    | `/sessions/{id}`                       | Get a chat with messages and its `documents` scope.                                                                                |
| `PATCH`                  | `/sessions/{id}`                       | Rename a chat: `{"title": "..."}`.                                                                                                 |
| `PUT`                    | `/sessions/{id}/documents`             | Set a chat's source scope: `{"documents": ["a.pdf", ...]}`. `[]` = all books.                                                      |
| `DELETE`                 | `/sessions/{id}`                       | Delete a chat.                                                                                                                     |
| `GET` / `POST` / `PATCH` | `/groups`                              | List / create (`?group_name=`) / rename (`{"old_name", "new_name"}`) groups.                                                       |
| `DELETE`                 | `/groups/{id}`                         | Delete a group (its chats are kept).                                                                                               |
| `POST` / `DELETE`        | `/groups/{group_name}/chats/{chat_id}` | Add / remove a chat to / from a group.                                                                                             |

**SSE events from `/query`** (each line is `data: {json}`):

| `type`    | Payload                                                                                                        |
| --------- | -------------------------------------------------------------------------------------------------------------- |
| `session` | `session_id` of the (possibly new) chat                                                                        |
| `token`   | `token`: a streamed text fragment                                                                              |
| `meta`    | `chunks`, `chunks_retrieved`, `documents_scope`, `usage`, `model`, `retrieval_ms`, `generation_ms`, `total_ms` |
| `done`    | end of stream                                                                                                  |

---

## Project structure

```
study_bucket/
├── Dockerfile
├── docker-compose.yaml        # luni app + MongoDB 7, named volumes
├── requirements.txt
├── .env                       # your secrets (git-ignored)
├── frontend/
│   ├── index.html             # single-page app
│   ├── css/                   # base, animations, components, responsive
│   └── js/
│       ├── api.js             # REST + SSE client
│       ├── chat.js            # chat, history, groups, meta panel
│       ├── scope.js           # per-chat source (book) picker
│       ├── library.js         # PDF library modal
│       ├── ui.js, utils.js    # layout, theme, rendering (Markdown/Mermaid/HTML)
│       └── app.js             # bootstrap
└── src/
    ├── main.py                # FastAPI app, routers, static files
    ├── ai/anthropic_llm.py    # Claude streaming client, allowed models
    ├── api/routes/            # documents, query, chat (sessions), group routers
    ├── services/              # document, query (RAG), chat history, group logic
    ├── db/
    │   ├── constants.py       # collection names, Chroma path
    │   ├── mongo_db/          # Mongo client (reads MONGO_HOST / MONGO_PORT)
    │   └── vector_db/         # Chroma client + embedding function
    └── util/                  # PDF parser, text chunker
```

---

## Troubleshooting

| Symptom                                               | Fix                                                                                                                                           |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Answers say _"I don't have enough information…"_      | The retrieved chunks didn't contain the answer. Check the transparency panel: are the right books in scope? Has the upload finished indexing? |
| `401` / `authentication_error` in logs                | `ANTHROPIC_API_KEY` missing or invalid. Fix `.env`, then `docker compose up -d --force-recreate luni`.                                        |
| `ServerSelectionTimeoutError` (MongoDB)               | Wrong `MONGO_HOST`: use `mongo` inside Docker, `localhost` outside. Make sure the `mongo` service is running.                                 |
| Search returns nothing after wiping the Chroma volume | `POST /documents/reindex` rebuilds the vector index from MongoDB.                                                                             |
| UI looks broken after an update                       | Hard-refresh once (Ctrl+Shift+R). Static assets are served with `Cache-Control: no-cache`, so this shouldn't recur.                           |
| Slow first start | The embedding model (~524 MB) is downloaded on the very first launch and cached in the `hf_models` volume. Later starts reuse it. |
