import os
from pymongo import MongoClient
from dotenv import load_dotenv
from ..constants import DATABASE, CHAT_SESSIONS_COLLECTION, REGISTRY_COLLECTION

load_dotenv()

URI = f"mongodb://{os.environ.get('MONGO_HOST')}:{os.environ.get('MONGO_PORT')}/"


def get_client_db():
    client = MongoClient(URI)
    db = client[DATABASE]

    if REGISTRY_COLLECTION not in db.list_collection_names():
        db.create_collection(REGISTRY_COLLECTION)
    if CHAT_SESSIONS_COLLECTION not in db.list_collection_names():
        db.create_collection(CHAT_SESSIONS_COLLECTION)
    return db
