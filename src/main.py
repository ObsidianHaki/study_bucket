from fastapi import FastAPI
from .api.routes.documents_router import documents_router
from .api.routes.query_router import query_router

#Application Entry point
app=FastAPI()
app.include_router(documents_router)
app.include_router(query_router)