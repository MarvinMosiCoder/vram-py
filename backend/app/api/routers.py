from fastapi import APIRouter

from app.api.admin import auth, dashboard, sidebar, admin, editor
from app.api import dynamic

# Each feature area owns its own APIRouter (see admin/auth.py,
# admin/admin.py, etc.) — this just combines them into the single router
# main.py mounts, so main.py never has to change when a new feature area
# is added.
router = APIRouter()
router.include_router(auth.router)
router.include_router(dashboard.router)
router.include_router(sidebar.router)
router.include_router(admin.router)
router.include_router(editor.router)

# MUST stay last. "/{module_path}" matches any single-segment path, so
# Starlette (first match wins) would shadow anything included below it.
router.include_router(dynamic.router)
