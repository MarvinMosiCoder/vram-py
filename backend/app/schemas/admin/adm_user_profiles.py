from pydantic import BaseModel

class AdmUserProfilesOut(BaseModel):
    id: int
    adm_user_id: int
    file_name: str
    ext: str
    created_by: int
    archived: None
    created_at: None
    updated_at: None

    class Config:
        from_attributes = True

class AdmUserProfilesIn(BaseModel):
    adm_user_id: int
    file_name: str
    ext: str
    created_by: int
    archived: None
    created_at: None
    updated_at: None

    class Config:
        from_attributes = True