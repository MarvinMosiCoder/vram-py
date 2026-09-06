from pydantic import BaseModel


class AdmSettingsOut(BaseModel):
    id: int
    name: str | None = None
    content: str | None = None
    content_input_type: str | None = None
    dataenum: str | None = None
    helper: str | None = None
    group_setting: int | None = None
    label: str | None = None

    class Config:
        from_attributes = True
