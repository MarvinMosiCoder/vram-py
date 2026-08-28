from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core import auth
from app.core.database import SessionLocal

# Paths that don't need a logged-in user. Everything else is blocked
# by default — a route added to routers.py without Depends(get_current_user)
# is still protected here instead of silently becoming public.
PUBLIC_PATHS = {"/login", "/register", "/docs", "/redoc", "/openapi.json"}


class RequireAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path in PUBLIC_PATHS:
            return await call_next(request)

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse({"detail": "Not authenticated"}, status_code=401)

        token = auth_header.removeprefix("Bearer ")
        db = SessionLocal()
        try:
            user = auth.get_user_from_token(token, db)
        finally:
            db.close()

        if user is None:
            return JSONResponse({"detail": "Could not validate credentials"}, status_code=401)

        return await call_next(request)
