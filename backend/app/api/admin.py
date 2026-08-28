from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app import models, schemas
from app.core import auth
from app.api.serializers import user_out

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[schemas.UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(1)),  # Super Administrator
):
    users = db.query(models.User).all()
    return [user_out(u) for u in users]
