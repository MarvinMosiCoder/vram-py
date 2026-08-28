from fastapi import APIRouter, Depends

from app import models
from app.core import auth

router = APIRouter(prefix="/editor", tags=["editor"])


@router.get("/content")
def editor_area(
    # No separate editor role exists yet — same as Super Administrator for now.
    current_user: models.User = Depends(auth.require_role(1)),
):
    return {"message": "Editor content area"}
