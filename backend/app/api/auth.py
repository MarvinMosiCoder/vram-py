from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_db
from app import models, schemas
from app.core import auth
from app.api.serializers import user_out

router = APIRouter(tags=["auth"])


@router.post("/register", response_model=schemas.UserOut)
def register(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = models.User(
        email=user_in.email,
        password=auth.hash_password(user_in.password),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return user_out(new_user)


@router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token = auth.create_access_token(data={
        "sub": user.email,
        "admin_id": user.id,
        "user_name": user.name,
        "theme_color": user.role.theme_color if user.role else None,
        "token_version": user.token_version,
    })
    return schemas.Token(access_token=token)


@router.post("/logout")
def logout(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    # Bumping token_version makes every token issued before this moment
    # fail the check in get_current_user — an immediate, real revocation,
    # not just "the client forgot its token."
    current_user.token_version += 1
    db.commit()
    return {"message": "Logged out"}


@router.get("/me", response_model=schemas.UserOut)
def read_me(current_user: models.User = Depends(auth.get_current_user)):
    return user_out(current_user)
