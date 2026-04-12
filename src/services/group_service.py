from click import group
from pymongo import cursor
from referencing import retrieval

from ..db.mongo_db.mongo_client import MONGO_CLIENT
from ..db.constants import HISTORY_GROUP_COLLECTION
from bson import ObjectId


history_group = MONGO_CLIENT.get_collection(HISTORY_GROUP_COLLECTION)  # get collection


def create_group(group_name: str) -> str:
    if history_group.find_one({"name": group_name}):  # name = id
        return None
    group = {"name": group_name, "chat_ids": []}
    result = history_group.insert_one(group)
    return str({"id": result.inserted_id, "name": group_name})


def delete_group(id: str):
    return history_group.delete_one({"_id": ObjectId(id)})


def get_all_groups():
    cursor = list(history_group.find({}, {"_id": 0}))
    groups = []
    for group in cursor:
        groups.append(group)
    return groups


def find_group(group_name: str):
    group = history_group.find_one({"name": group_name}, {"_id": 0})
    if group:
        return group
    return None

#patch group in case of chanung names
def patch_group_name(old_name:str,new_name):
    query_filter={"name":old_name}
    update_operation={'$set':{"name":new_name}}
    history_group.update_one(query_filter,update_operation)
    return "Update Suceed"
   


    


