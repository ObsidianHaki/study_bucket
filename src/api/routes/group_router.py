from fastapi import APIRouter, HTTPException
from ...services import group_service
from pydantic import BaseModel


group_router = APIRouter(prefix="/groups", tags=["grouping"])


@group_router.post("")
def create_group(group_name:str):
    # service must create 
    # check before if name is already existing if yes then decline
    response=group_service.create_group(group_name=group_name)
    if response is None:
        raise HTTPException(status_code=409, detail=f"Group  '{group_name}' already exists")
    return response

@group_router.delete("/{id}")
def delete_group(id:str):
    return group_service.delete_group(id)

@group_router.get("/")
def get_all_groups():
    return group_service.get_all_groups()

@group_router.get("/{group_name}")
def get_group(group_name:str):
    return group_service.find_group(group_name)

class UpdateGroup(BaseModel):
    old_name: str
    new_name:str

@group_router.patch("")
def rename_group(item:UpdateGroup):
    return str(group_service.patch_group_name(old_name=item.old_name,new_name=item.new_name))