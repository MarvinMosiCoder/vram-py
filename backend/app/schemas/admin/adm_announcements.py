from pydantic import BaseModel

class AdmAnnouncementsOut(BaseModel):
    id: int
    title: str
    message: str
    content: str
    status: str
    created_by: int
    updated_by: int
    created_at: None
    updated_at: None

    class Config:
        from_attributes = True