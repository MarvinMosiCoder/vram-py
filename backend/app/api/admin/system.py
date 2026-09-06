from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app import models, schemas
from app.core import auth


router = APIRouter(prefix="/system", tags=["system"])


@router.get("/logo", response_model=str)
def get_app_logo(
    db: Session = Depends(get_db),
):
    logo_setting = (
        db.query(models.AdmSettings)
        .filter(models.AdmSettings.name == "logo")
        .first()
    )
    
    return logo_setting.content if logo_setting and logo_setting.content else ""

@router.get("/appname", response_model=str)
def get_app_name(
    db: Session = Depends(get_db),
):
    appname_setting = (
        db.query(models.AdmSettings)
        .filter(models.AdmSettings.name == "appname")
        .first()
    )
    return appname_setting.content if appname_setting and appname_setting.content else "VRAM"

