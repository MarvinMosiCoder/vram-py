from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app import models

# --- Config ---------------------------------------------------------
# In a real app these come from environment variables, never hardcoded.
SECRET_KEY = "change-this-to-a-long-random-string-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Tells FastAPI where clients send their email/password to get a token.
# Also lets FastAPI auto-extract the "Authorization: Bearer <token>" header.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


# --- Password helpers ------------------------------------------------
def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


# --- JWT helpers -------------------------------------------------------
def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_user_from_token(token: str, db: Session) -> models.User | None:
    """
    Decodes a JWT and returns the User it belongs to, or None if the
    token is malformed, expired, or was revoked (token_version mismatch —
    see /logout). Shared by get_current_user (per-route) and
    RequireAuthMiddleware (global fail-closed check) so both enforce the
    exact same rule instead of two copies drifting apart.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        token_version = payload.get("token_version")
        if email is None or token_version is None:
            return None
    except JWTError:
        return None

    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None or user.token_version != token_version:
        return None
    return user


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> models.User:
    """
    Runs on every protected route. FastAPI's `Depends` mechanism calls
    this automatically, decodes the JWT from the request header, and
    hands the matching User row to whichever route asked for it.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    user = get_user_from_token(token, db)
    if user is None:
        raise credentials_exception
    return user


def require_role(*allowed_role_ids: int):
    """
    This is the core of RBAC. It's a "dependency factory": calling
    require_role(1) returns a function that FastAPI runs before
    the route. If the logged-in user's role id isn't in allowed_role_ids,
    it blocks the request with a 403 before your route code ever runs.

    Checked by adm_roles.id, not name — a role can be renamed without
    breaking every route that requires it.

    Usage in a route:
        @app.get("/admin-only")
        def admin_route(user = Depends(require_role(1))):
            ...
    """
    def role_checker(user: models.User = Depends(get_current_user)) -> models.User:
        if user.id_adm_role not in allowed_role_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of these role ids: {', '.join(str(r) for r in allowed_role_ids)}",
            )
        return user

    return role_checker
