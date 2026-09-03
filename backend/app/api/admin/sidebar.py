from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app import models, schemas
from app.core import auth

router = APIRouter(tags=["sidebar"])


@router.get("/admin_sidebar", response_model=list[schemas.ModuleOut])
def admin_sidebar(
    db: Session = Depends(get_db)
):
    menus = (
        db.query(models.Modules)
        .filter(models.Modules.is_active == 1, models.Modules.is_protected == 1)
        .order_by(models.Modules.id.asc())
        .all()
    )
    return menus


@router.get("/user_sidebar", response_model=list[schemas.MenuOut])
def user_sidebar(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    def child_query(parent_id):
        return (
            db.query(models.Menuses)
            .filter(
                models.Menuses.is_active == 1,
                models.Menuses.is_dashboard == 0,
                models.Menuses.parent_id == parent_id,
                models.Menuses.id_adm_role == current_user.id_adm_role,
            )
            .order_by(models.Menuses.sorting.asc())
        )

    menus = child_query(None).all()
    # One level deep, matching Laravel's CommonHelpers::sidebarMenu() -- a
    # top-level menu's own children, fetched per-row and attached here so
    # MenuOut (from_attributes=True) can read them straight off the object.
    for menu in menus:
        menu.children = child_query(menu.id).all() or None
    return menus
