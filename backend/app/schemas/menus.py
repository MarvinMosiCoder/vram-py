from pydantic import BaseModel


class MenuOut(BaseModel):
    id: int
    name: str | None = None
    path: str | None = None
    slug: str | None = None
    icon: str | None = None
    color: str | None = None
    sorting: int | None = None
    parent_id: int | None = None

    class Config:
        from_attributes = True
