from pydantic import BaseModel

class AdmPasswordHistoryOut(BaseModel):
    id: int
    adm_user_id: int
    adm_user_old_pass: str
    created_at: None
    updated_at: None

    class Config:
        from_attributes = True