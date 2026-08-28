from pydantic import BaseModel, EmailStr


# --- Pydantic models = "shapes" of data going in/out of the API.
# FastAPI uses these to validate requests and to control what gets
# sent back in responses (so we never accidentally leak a password hash).

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

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class ModuleOut(BaseModel):
    id: int
    name: str | None = None
    icon: str | None = None
    path: str | None = None
    is_protected: int | None = None

    class Config:
        from_attributes = True

class MenuOut(BaseModel):
    id: int
    name: str | None = None
    path: str | None = None
    slug: str | None = None
    icon: str | None = None
    color: str | None = None
    sorting: int | None = None
    module: ModuleOut | None = None

    class Config:
        from_attributes = True