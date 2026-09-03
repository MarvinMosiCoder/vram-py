from pydantic import BaseModel


class MenuOut(BaseModel):
    id: int
    name: str | None = None
    type: str | None = None
    path: str | None = None
    slug: str | None = None
    icon: str | None = None
    color: str | None = None
    sorting: int | None = None
    parent_id: int | None = None
    # One level deep, matching Laravel's CommonHelpers::sidebarMenu() -- a
    # menu row's own children, attached by the /user_sidebar route.
    children: list["MenuOut"] | None = None

    class Config:
        from_attributes = True


MenuOut.model_rebuild()
