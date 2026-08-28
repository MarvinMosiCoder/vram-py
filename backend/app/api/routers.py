from fastapi import APIRouter

from app.api import auth, dashboard, sidebar, admin, editor

# Each feature area owns its own APIRouter (see auth.py, admin.py, etc.) —
# this just combines them into the single router main.py mounts, so
# main.py never has to change when a new feature area is added.
router = APIRouter()
router.include_router(auth.router)
router.include_router(dashboard.router)
router.include_router(sidebar.router)
router.include_router(admin.router)
router.include_router(editor.router)
