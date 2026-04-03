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
    #MongoDB index creation for the collections
    db[REGISTRY_COLLECTION].create_index("filename", unique=True)
    db[CHAT_SESSIONS_COLLECTION].create_index([("updated_at", -1)])

    return db

MONGO_CLIENT=get_client_db()