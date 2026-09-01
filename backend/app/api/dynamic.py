import inspect
import re

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app import models
from app.core import auth
from app.core.database import get_db
from app.modules.registry import CONTROLLERS, discover

# Registration, once, at import time. Scans app/modules/admin/ and imports
# every controller file, which is what runs their @controller decorators.
# Called here rather than from a package __init__ so that importing the
# registry stays free of side effects -- see discover()'s docstring.
discover()

router = APIRouter(tags=["modules"])

# adm_modules.path is admin-supplied. Constrain it before it touches a query.
MODULE_PATH_RE = re.compile(r"^[a-z0-9_-]+$")

async def _read_body(request: Request) -> dict:
    if request.method != "POST":
        return {}
    content_type = request.headers.get("content-type", "")
    if content_type.startswith("application/json"):
        try:
            return await request.json()
        except Exception:
            return {}
    if "form" in content_type:
        return dict(await request.form())
    return {}

def _method_name(http_method: str, action: str | None) -> str:
    """GET  /users              -> get_index
       POST /users/bulk-action  -> post_bulk_action"""
    verb = http_method.lower()
    if action is None:
        return f"{verb}_index"
    return f"{verb}_{action.replace('-', '_')}"


async def _dispatch(request, db, user, module_path, action, rest, body):
    if not MODULE_PATH_RE.match(module_path):
        raise HTTPException(status_code=404, detail="Not Found")

    module = (
        db.query(models.Modules)
        .filter(models.Modules.path == module_path)
        .filter(models.Modules.is_active == 1)
        .first()
    )
    if module is None:
        raise HTTPException(status_code=404, detail="Not Found")

    controller_cls = CONTROLLERS.get((module.controller or "").strip())
    if controller_cls is None:
        # The row exists but no class claims it -- a config error, not a 404.
        # Usually means the generated file was deleted, or the row's
        # controller string does not match any @controller() in modules/admin/.
        raise HTTPException(
            status_code=500,
            detail=f"Module '{module.path}' names unregistered controller '{module.controller}'",
        )

    instance = controller_cls(module=module, db=db, user=user, request=request, body=body)

    name = _method_name(request.method, action)
    handler = getattr(instance, name, None)
    if handler is None or not getattr(handler, "__module_action__", False):
        raise HTTPException(status_code=404, detail="Not Found")

    args = [segment for segment in rest.split("/") if segment]

    # Check arity up front. Catching TypeError around the call instead
    # would swallow every TypeError raised *inside* the controller and
    # report a real bug as a 404.
    try:
        inspect.signature(handler).bind(*args)
    except TypeError:
        raise HTTPException(status_code=404, detail="Not Found")

    return handler(*args)



# --- The three fixed routes -----------------------------------------
# api_route() takes a methods list, so one declaration covers GET + POST.

@router.api_route("/{module_path}", methods=["GET", "POST"])
async def module_index(
    module_path: str,
    request: Request,
    db: Session = Depends(get_db),
    user: models.User = Depends(auth.get_current_user),
):
    return await _dispatch(request, db, user, module_path, None, "", await _read_body(request))


@router.api_route("/{module_path}/{action}", methods=["GET", "POST"])
async def module_action(
    module_path: str,
    action: str,
    request: Request,
    db: Session = Depends(get_db),
    user: models.User = Depends(auth.get_current_user),
):
    return await _dispatch(request, db, user, module_path, action, "", await _read_body(request))


@router.api_route("/{module_path}/{action}/{rest:path}", methods=["GET", "POST"])
async def module_action_args(
    module_path: str,
    action: str,
    rest: str,
    request: Request,
    db: Session = Depends(get_db),
    user: models.User = Depends(auth.get_current_user),
):
    return await _dispatch(request, db, user, module_path, action, rest, await _read_body(request))
