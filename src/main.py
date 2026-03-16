from fastapi import FastAPI
from .api.routes.documents import documents_router
from .api.routes.query import query_router

app=FastAPI()
app.include_router(documents_router)
app.include_router(query_router)