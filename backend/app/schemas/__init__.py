from pydantic import BaseModel, EmailStr


# --- Pydantic models = "shapes" of data going in/out of the API.
# FastAPI uses these to validate requests and to control what gets
# sent back in responses (so we never accidentally leak a password hash).

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: str = "viewer"  # default role if none specified


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: EmailStr
    role: str

    class Config:
        from_attributes = True  # lets this read directly from a SQLAlchemy object


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
