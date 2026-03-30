import os
from pymongo import MongoClient
from dotenv import load_dotenv
load_dotenv()

COLLECTION = "knowledge_pool"
CHAT_SESSIONS_COLLECTION = "chat_sessions"

URI=f"mongodb://{os.environ.get('MONGO_HOST')}:{os.environ.get('MONGO_PORT')}/"


def get_client_db():
    client = MongoClient(URI)
    db = client["study_bucket"]

    if  COLLECTION not in db.list_collection_names():
        db.create_collection(COLLECTION)
    if CHAT_SESSIONS_COLLECTION not in db.list_collection_names():
        db.create_collection(CHAT_SESSIONS_COLLECTION)
    return db
