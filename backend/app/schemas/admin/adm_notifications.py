from pydantic import BaseModel

class AdmNotificationsOut(BaseModel):
    id: int
    adm_user_id: int
    type: str
    content: str
    url: int
    is_read: int
    created_at: None
    updated_at: None

    class Config:
        from_attributes = True