import os
from pymongo import MongoClient
from dotenv import load_dotenv
from ..constants import DATABASE, CHAT_SESSIONS_COLLECTION, CHUNKS_COLLECTION

load_dotenv()

URI = f"mongodb://{os.environ.get('MONGO_HOST')}:{os.environ.get('MONGO_PORT')}/"


def get_client_db():
    client = MongoClient(URI)
    db = client[DATABASE]

    # Ensure collections exist
    if CHUNKS_COLLECTION not in db.list_collection_names():
        db.create_collection(CHUNKS_COLLECTION)
    if CHAT_SESSIONS_COLLECTION not in db.list_collection_names():
        db.create_collection(CHAT_SESSIONS_COLLECTION)

    # Create indexes - filename in chunks collection for lookups during reindex/delete
    db[CHUNKS_COLLECTION].create_index("filename")
    db[CHAT_SESSIONS_COLLECTION].create_index([("updated_at", -1)])

    return db


MONGO_CLIENT = get_client_db()
