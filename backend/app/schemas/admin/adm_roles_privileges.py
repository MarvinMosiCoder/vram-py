from pydantic import BaseModel

class AdminRolesPrivileges(BaseModel):
    id: int
    is_create: int | None = None
    is_read: int | None = None
    is_edit: int | None = None
    is_delete: int | None = None
    is_void: int | None = None
    is_override: int | None = None
    id_adm_roles: int | None = None
    id_adm_modules: int | None = None
    created_at: None = None
    updated_at: None = None

    class Config:
        from_attributes = True  
