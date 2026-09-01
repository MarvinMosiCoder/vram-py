# --- Pydantic models = "shapes" of data going in/out of the API.
# FastAPI uses these to validate requests and to control what gets
# sent back in responses (so we never accidentally leak a password hash).
#
# One file per area under admin/, mirroring app/models/. Everything is
# re-exported here so routes keep using `from app import schemas` /
# `schemas.UserOut`.
from app.schemas.admin import (
    AdminMenu,
    MenuOut,
    ModuleOut,
    Token,
    UserCreate,
    UserLogin,
    UserOut,
)

__all__ = [
    "UserCreate",
    "UserLogin",
    "UserOut",
    "Token",
    "ModuleOut",
    "MenuOut",
    "AdminMenu",
]
