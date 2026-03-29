import os
from pymongo import MongoClient
from dotenv import load_dotenv
load_dotenv()

COLLECTION = "knowledge_pool"
with MongoClient(f"mongodb://{os.environ.get("MONGO_HOST")}:{os.environ.get("MONGO_PORT")}/") as client:
    db = client["study_bucket"] # choose Database

    if  COLLECTION not in db.list_collection_names():
        db.create_collection(COLLECTION) # create single collection
#TODO: Find a solution to return the clients, so that a service implementation can build on that logic