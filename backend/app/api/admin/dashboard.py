from fastapi import APIRouter, Depends

from app import models
from app.core import auth

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard")
def dashboard(current_user: models.User = Depends(auth.get_current_user)):
    return {"message": f"Welcome {current_user.email}"}
