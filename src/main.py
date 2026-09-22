import logging
from pathlib import Path

from fastapi import FastAPI

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    force=True,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from .api.routes.documents_router import documents_router
from .api.routes.query_router import query_router
from .api.routes.chat_router import chat_router
from .api.routes.group_router import group_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["*"],
)

app.include_router(documents_router)
app.include_router(query_router)
app.include_router(chat_router)
app.include_router(group_router)

frontend_dir = Path(__file__).parent.parent / "frontend"


class RevalidatedStaticFiles(StaticFiles):
    """Make browsers revalidate assets (cheap via ETag) so HTML and CSS/JS never get out of sync."""

    def file_response(self, *args, **kwargs):
        response = super().file_response(*args, **kwargs)
        response.headers["Cache-Control"] = "no-cache"
        return response


app.mount("/static", RevalidatedStaticFiles(directory=frontend_dir), name="static")


@app.get("/")
def serve_frontend():
    return FileResponse(frontend_dir / "index.html", headers={"Cache-Control": "no-cache"})
