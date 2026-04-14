from ..db.mongo_db.mongo_client import MONGO_CLIENT
from ..db.constants import HISTORY_GROUP_COLLECTION
from bson import ObjectId


history_group = MONGO_CLIENT.get_collection(HISTORY_GROUP_COLLECTION)


def create_group(group_name: str) -> dict | None:
    if history_group.find_one({"name": group_name}):
        return None
    group = {"name": group_name, "chat_ids": []}
    result = history_group.insert_one(group)
    return {"id": str(result.inserted_id), "name": group_name}


def delete_group(id: str):
    return history_group.delete_one({"_id": ObjectId(id)})


def get_all_groups() -> list[dict]:
    cursor = history_group.find({})
    groups = []
    for group in cursor:
        group["_id"] = str(group["_id"])
        groups.append(group)
    return groups


def find_group(group_name: str):
    group = history_group.find_one({"name": group_name}, {"_id": 0})
    return group if group else None


def patch_group_name(old_name: str, new_name: str):
    if history_group.find_one({"name": new_name}):
        return None
    result = history_group.update_one(
        {"name": old_name}, {"$set": {"name": new_name}}
    )
    return result.modified_count > 0


def add_chat_to_group(group_name: str, chat_id: str) -> bool:
    # Remove chat from any existing group first
    history_group.update_many(
        {"chat_ids": chat_id}, {"$pull": {"chat_ids": chat_id}}
    )
    result = history_group.update_one(
        {"name": group_name}, {"$addToSet": {"chat_ids": chat_id}}
    )
    return result.modified_count > 0


def remove_chat_from_group(group_name: str, chat_id: str) -> bool:
    result = history_group.update_one(
        {"name": group_name}, {"$pull": {"chat_ids": chat_id}}
    )
    return result.modified_count > 0


