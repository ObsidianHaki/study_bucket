from fastapi import APIRouter, HTTPException
from ...services import group_service
from pydantic import BaseModel


group_router = APIRouter(prefix="/groups", tags=["grouping"])


@group_router.post("")
def create_group(group_name: str):
    response = group_service.create_group(group_name=group_name)
    if response is None:
        raise HTTPException(status_code=409, detail=f"Group '{group_name}' already exists")
    return response


@group_router.delete("/{id}")
def delete_group(id: str):
    group_service.delete_group(id)
    return {"status": "deleted"}


@group_router.get("/")
def get_all_groups():
    return group_service.get_all_groups()


@group_router.get("/{group_name}")
def get_group(group_name: str):
    group = group_service.find_group(group_name)
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found")
    return group


class UpdateGroup(BaseModel):
    old_name: str
    new_name: str


@group_router.patch("")
def rename_group(item: UpdateGroup):
    result = group_service.patch_group_name(old_name=item.old_name, new_name=item.new_name)
    if result is None:
        raise HTTPException(status_code=409, detail=f"Group '{item.new_name}' already exists")
    return {"status": "renamed"}


@group_router.post("/{group_name}/chats/{chat_id}")
def add_chat_to_group(group_name: str, chat_id: str):
    result = group_service.add_chat_to_group(group_name, chat_id)
    if not result:
        raise HTTPException(status_code=404, detail="Group not found")
    return {"status": "added"}


@group_router.delete("/{group_name}/chats/{chat_id}")
def remove_chat_from_group(group_name: str, chat_id: str):
    result = group_service.remove_chat_from_group(group_name, chat_id)
    if not result:
        raise HTTPException(status_code=404, detail="Group or chat not found")
    return {"status": "removed"}