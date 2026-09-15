from fastapi import APIRouter, Depends
from sqlalchemy import select
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

    visible = select(models.MenusRoles.id_adm_menus).where(
        models.MenusRoles.id_adm_role == current_user.id_adm_role
    )

    def child_query(parent_id):
        return (
            db.query(models.Menuses)
            .filter(
                models.Menuses.is_active == 1,
                models.Menuses.is_dashboard == 0,
                models.Menuses.parent_id == parent_id,
                models.Menuses.id.in_(visible),
            )
            .order_by(models.Menuses.sorting.asc())
        )

    menus = child_query(None).all()

    for menu in menus:
        menu.children = child_query(menu.id).all() or None
    return menus
