from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_db
from app import models
from app import schemas
from app.core import auth

# APIRouter behaves like a mini FastAPI app. You declare routes on it
# the same way you would on `app`, then main.py mounts the whole group
# at once with app.include_router().
router = APIRouter()

@router.post("/register", response_model=schemas.UserOut)
def register(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    role = db.query(models.Role).filter(models.Role.name == user_in.role).first()
    if not role:
        raise HTTPException(status_code=400, detail=f"Role '{user_in.role}' does not exist")

    new_user = models.User(
        email=user_in.email,
        hashed_password=auth.hash_password(user_in.password),
        role_id=role.id,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return schemas.UserOut(id=new_user.id, email=new_user.email, role=role.name)


@router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token = auth.create_access_token(data={"sub": user.email})
    return schemas.Token(access_token=token)


@router.get("/me", response_model=schemas.UserOut)
def read_me(current_user: models.User = Depends(auth.get_current_user)):
    return schemas.UserOut(id=current_user.id, email=current_user.email, role=current_user.role.name)


@router.get("/dashboard")
def dashboard(current_user: models.User = Depends(auth.get_current_user)):
    return {"message": f"Welcome {current_user.email}, your role is {current_user.role.name}"}


@router.get("/admin/users", response_model=list[schemas.UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role("admin")),
):
    users = db.query(models.User).all()
    return [schemas.UserOut(id=u.id, email=u.email, role=u.role.name) for u in users]


@router.get("/editor/content")
def editor_area(
    current_user: models.User = Depends(auth.require_role("admin", "editor")),
):
    return {"message": "Editor content area"}
