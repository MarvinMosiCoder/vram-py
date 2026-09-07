from datetime import datetime
from pathlib import Path
import shutil
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app import models
from app.core import auth
from app.core.database import get_db


router = APIRouter(tags=["profile"])

PROFILE_DIRECTORY = Path(__file__).resolve().parents[4] / "frontend" / "public" / "images" / "profile"
AVATAR_DIRECTORY = PROFILE_DIRECTORY.parent / "profile-avatars"
AVATAR_FILES = {
    "cat": "cat.svg",
    "fox": "fox.svg",
    "panda": "panda.svg",
    "person-amber": "person-amber.svg",
    "person-rose": "person-rose.svg",
    "person-violet": "person-violet.svg",
    "support-blue": "support-blue.svg",
    "support-green": "support-green.svg",
    "tech": "tech.svg",
    "ai-avatar-1": "ai-avatar-1.png",
    "ai-avatar-2": "ai-avatar-2.png",
    "ai-avatar-3": "ai-avatar-3.png",
    "ai-avatar-4": "ai-avatar-4.png",
    "ai-avatar-5": "ai-avatar-5.png",
    "ai-avatar-6": "ai-avatar-6.png",
    "ai-avatar-7": "ai-avatar-7.png",
    "ai-avatar-8": "ai-avatar-8.png",
}
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "avif"}
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/avif"}
MAX_PROFILE_SIZE = 5 * 1024 * 1024


class AvatarRequest(BaseModel):
    avatar: str = Field(min_length=1)


class ProfileSummary(BaseModel):
    id: int
    file_name: str


class UpdateProfileRequest(BaseModel):
    profile_id: int
    action: str


@router.get("/profiles", response_model=list[ProfileSummary])
def get_profiles(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    user_id = current_user.id
    profiles = (
        db.query(models.AdmUserProfiles)
        .filter(models.AdmUserProfiles.adm_user_id == user_id)
        .order_by(models.AdmUserProfiles.id.desc())
        .all()
    )
    return [
        {"id": profile.id, "file_name": profile.file_name}
        for profile in profiles
    ]


@router.post("/save-edit-image")
def save_edit_image(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
    profile_image: UploadFile = File(...),
):
    user_id = current_user.id
    extension = Path(profile_image.filename or "").suffix.lower().lstrip(".")
    if extension not in ALLOWED_EXTENSIONS or profile_image.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=422, detail="Please upload a JPG, PNG, WebP, or AVIF image.")

    image_data = profile_image.file.read(MAX_PROFILE_SIZE + 1)
    if len(image_data) > MAX_PROFILE_SIZE:
        raise HTTPException(status_code=422, detail="The profile image must be 5 MB or smaller.")
    if not image_data:
        raise HTTPException(status_code=422, detail="The profile image cannot be empty.")

    PROFILE_DIRECTORY.mkdir(parents=True, exist_ok=True)
    now = datetime.utcnow()
    db.query(models.AdmUserProfiles).filter(
        models.AdmUserProfiles.adm_user_id == user_id
    ).update({"archived": now}, synchronize_session=False)

    profile = models.AdmUserProfiles(
        adm_user_id=user_id,
        ext=extension,
        created_by=user_id,
        created_at=now,
    )
    db.add(profile)
    db.flush()

    filename = f"{user_id}-{profile.id}.{extension}"
    profile.file_name = filename

    try:
        (PROFILE_DIRECTORY / filename).write_bytes(image_data)
        db.commit()
    except OSError:
        db.rollback()
        raise HTTPException(status_code=500, detail="The profile image could not be saved.")
    except Exception:
        db.rollback()
        raise

    return {"message": "Image uploaded!", "status": "success", "file_name": filename}

@router.post("/save-profile-avatar")
def save_profile_avatar(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
    payload: AvatarRequest = None,
):
    user_id = current_user.id
    avatar_file = AVATAR_FILES.get(payload.avatar) if payload else None
    if not avatar_file:
        raise HTTPException(status_code=422, detail="Please select a valid avatar.")

    source = AVATAR_DIRECTORY / avatar_file
    if not source.is_file():
        raise HTTPException(status_code=404, detail="Avatar not found.")

    now = datetime.utcnow()
    db.query(models.AdmUserProfiles).filter(
        models.AdmUserProfiles.adm_user_id == user_id,
        models.AdmUserProfiles.archived.is_(None),
    ).update({"archived": now}, synchronize_session=False)

    extension = Path(avatar_file).suffix.lstrip(".")
    profile = models.AdmUserProfiles(
        adm_user_id=user_id,
        ext=extension,
        created_by=user_id,
        created_at=now,
    )
    db.add(profile)
    db.flush()

    filename = f"{user_id}-{profile.id}.{extension}"
    destination = PROFILE_DIRECTORY / filename
    profile.file_name = filename

    try:
        PROFILE_DIRECTORY.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)
        db.commit()
    except OSError:
        db.rollback()
        raise HTTPException(status_code=500, detail="The avatar could not be saved.")
    except Exception:
        db.rollback()
        raise

    return {"message": "Avatar updated!", "status": "success", "file_name": filename}

@router.post("/update-profile")
def update_profile(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
    payload: UpdateProfileRequest = None,
):
    user_id = current_user.id
    profile = db.query(models.AdmUserProfiles).filter(
        models.AdmUserProfiles.id == payload.profile_id,
        models.AdmUserProfiles.adm_user_id == user_id,
    ).first()

    if not profile:
        return {"message": "Profile not found.", "status": "warning"}

    if payload.action == "update":
        now = datetime.utcnow()
        db.query(models.AdmUserProfiles).filter(
            models.AdmUserProfiles.adm_user_id == user_id,
        ).update({"archived": now}, synchronize_session=False)
        profile.archived = None
        profile.updated_at = now
        db.commit()
        return {"message": "Profile changed!", "status": "success", "file_name": profile.file_name}

    if payload.action == "delete":
        if not profile.file_name:
            return {"message": "Image not found.", "status": "warning"}

        image_path = PROFILE_DIRECTORY / profile.file_name
        if not image_path.is_file():
            return {"message": "Image not found.", "status": "warning"}

        image_path.unlink()
        db.delete(profile)
        db.commit()
        return {"message": "Image deleted successfully!", "status": "success"}

    if payload.action == "download":
        if not profile.file_name:
            return {"message": "Profile not found.", "status": "error"}

        image_path = PROFILE_DIRECTORY / profile.file_name
        if not image_path.is_file():
            return {"message": "File not found.", "status": "warning"}

        return FileResponse(image_path, filename=profile.file_name)

    return {"message": "Invalid action.", "status": "error"}
