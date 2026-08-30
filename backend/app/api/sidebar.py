from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app import models, schemas
from app.core import auth

router = APIRouter(tags=["admin_sidebar"])


@router.get("/admin_sidebar", response_model=list[schemas.AdminMenu])
def sidebar(
    db: Session = Depends(get_db)
):
    menus = (
        db.query(models.AdminMenuses)
        .filter(models.AdminMenuses.is_active == 1)
        .order_by(models.AdminMenuses.sorting)
        .all()
    )
    return menus
