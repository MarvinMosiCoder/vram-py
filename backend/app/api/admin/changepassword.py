from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, model_validator
from sqlalchemy.orm import Session
import bcrypt
from app.core.database import get_db
from app import models, schemas
from app.core import auth

router = APIRouter()

class CheckPasswordRequest(BaseModel):
    current_password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

@model_validator(mode="after")
def passwords_match(self):
        if self.new_password != self.confirm_password:
            raise ValueError("Confirm password must match new_password")
        return self

def check_password_in_array(new_password: str, old_hashes: list[str]) -> bool:
    for old_hash in old_hashes:
        if bcrypt.checkpw(new_password.encode("utf-8"), old_hash.encode("utf-8")):
            return True
    return False

DEFAULT_PASSWORD = "qwerty"
PASSWORD_MAX_AGE_MONTHS = 3
MAX_WAIVERS = 4

def _months_between(start: date, end: date) -> int:
    months = (end.year - start.year) * 12 + (end.month - start.month)
    if end.day < start.day:
        months -= 1
    return months

def _uses_default_password(user: models.User) -> bool:
    return bcrypt.checkpw(DEFAULT_PASSWORD.encode("utf-8"), user.password.encode("utf-8"))

def _password_expired(user: models.User) -> bool:
    if user.last_password_updated is None:
        return True
    return _months_between(user.last_password_updated, date.today()) > PASSWORD_MAX_AGE_MONTHS

def _password_policy(user: models.User) -> dict:
    is_default = _uses_default_password(user)
    waivers_used = user.waiver_count or 0
    return {
        "must_change": is_default or _password_expired(user),
        "is_default_password": is_default,
        "can_waive": not is_default and waivers_used < MAX_WAIVERS,
        "waivers_used": waivers_used,
        "max_waivers": MAX_WAIVERS,
    }

@router.get("/password-policy")
def password_policy(current_user: models.User = Depends(auth.get_current_user)):
    return _password_policy(current_user)

@router.post("/check-password")
def check_password(
    payload: CheckPasswordRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.id == current_user.id).first()

    if user and bcrypt.checkpw(payload.current_password.encode("utf-8"), user.password.encode("utf-8")):
        return {"success": True}

    return {"success": False, "message": "Incorrect current password"}

@router.post("/save-change-password")
def save_change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    user = db.query(models.User).filter(models.User.id == current_user.id).first()

    if not user or not bcrypt.checkpw(payload.current_password.encode("utf-8"), user.password.encode("utf-8")):
        return {"message": "Incorrect Current Password.", "status": "error"}
    
    password_history = (
        db.query(models.AdminPasswordHistory)
        .filter(models.AdminPasswordHistory.adm_user_id == current_user.id)
        .all()
    )
    old_hashes = [row.adm_user_old_pass for row in password_history]

    if check_password_in_array(payload.new_password, old_hashes):
        return {"message": "Password already used! Please try another password", "status": "error"}

    # Update password
    new_hashed_password = bcrypt.hashpw(payload.new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    user.password = new_hashed_password
    user.last_password_updated = date.today()
    user.waiver_count = 0
    db.commit()
    db.refresh(user)

    # Save password history
    new_history_entry = models.AdminPasswordHistory(
        adm_user_id=user.id,
        adm_user_old_pass=user.password,
        created_at=datetime.now(),
    )
    db.add(new_history_entry)
    db.commit()
    return {"message": "Password Updated, You Will Be Logged-Out.", "status": "success"}

@router.post("/waive-change-password")
def waive_change_password(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    policy = _password_policy(user)
    if policy["is_default_password"]:
        return {"message": "Change the default password before waiving.", "status": "error"}
    if not policy["can_waive"]:
        return {"message": f"You cannot waive more than {MAX_WAIVERS} times!", "status": "error"}

    user.last_password_updated = date.today()
    user.waiver_count = (user.waiver_count or 0) + 1
    db.commit()
    return {"message": "Waive completed!", "status": "success"}
