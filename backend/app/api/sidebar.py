from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app import models, schemas
from app.core import auth

router = APIRouter(tags=["sidebar"])


@router.get("/sidebar", response_model=list[schemas.MenuOut])
def sidebar(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    query = db.query(models.Menuses).join(models.Modules).filter(
        models.Menuses.is_active == 1,
        models.Modules.is_active == 1,
    )

    # Superadmins see every menu; everyone else only sees menus
    # tagged with their own role.
    if not (current_user.role and current_user.role.is_superadmin):
        query = query.filter(models.Menuses.id_adm_role == current_user.id_adm_role)

    menus = query.order_by(models.Menuses.sorting).all()
    return menus
