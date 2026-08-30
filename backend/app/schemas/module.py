from pydantic import BaseModel


class ModuleOut(BaseModel):
    id: int
    name: str | None = None
    icon: str | None = None
    path: str | None = None
    is_protected: int | None = None
    
    class Config:
        from_attributes = True
