from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: EmailStr
    name: str | None = None
    theme_color: str | None = None
    role: str | None = None
    role_id: int | None = None

    class Config:
        from_attributes = True  # lets this read directly from a SQLAlchemy object
