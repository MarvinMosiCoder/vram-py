"""Python counterpart of Laravel's app/Helpers/CommonHelpers.php.

Two groups of helpers, both lifted from the original:

* **Identity** -- isSuperadmin(), myId(), myPrivilegeId(), myThemeColor().
  Laravel reads these off the session; there is no session here, so each
  one takes the User that Depends(auth.get_current_user) already resolved
  from the JWT.

* **Capability** -- isView/isCreate/isUpdate/isRead/isDelete(), and the two
  tiers GeneratedModuleController builds out of them: module_access()
  (privileges only) and permitted_actions() (privileges AND the module's
  own `actions` config). Those two are the `moduleAccess` and `actions`
  props the React runtime already reads.

WHAT IS MISSING, AND IT MATTERS
-------------------------------
The Laravel versions resolve a *per-role privilege row*::

    public static function isCreate(){
        if (self::isSuperadmin()) return true;
        foreach (Session::get('admin_privileges_roles') as $v) {
            if ($v->path == self::getModulePath()) return (bool) $v->is_create;
        }
    }

backed by adm_privileges, adm_privileges_roles and adm_menus_privileges.
**None of those three tables exist in this port.** adm_roles carries
is_superadmin and nothing else.

So _privilege() below cannot answer for a non-superadmin, and
PRIVILEGES_DEFAULT decides what happens instead. It is True, which keeps
today's behaviour exactly: a module's own `actions` config is the only
gate, identical for every caller. Flip it to False the moment the
privilege tables land and the system becomes deny-by-default for everyone
but a superadmin -- that single constant is the whole switch.

Until then, require() in generated_module.py is capability enforcement,
not authorization. docs/MODULES.md says the same under "Known gaps".
"""
from datetime import datetime

from fastapi import HTTPException

# What a capability resolves to for a non-superadmin while the privilege
# tables are absent. True preserves current behaviour; False makes every
# module write superadmin-only. See the module docstring.
PRIVILEGES_DEFAULT = True


# --- Identity (Laravel reads the session; here it is the JWT's user) ---
def is_superadmin(user) -> bool:
    """CommonHelpers::isSuperadmin(). The role's flag is an integer column,
    so this normalises it to a real bool."""
    role = getattr(user, "role", None)
    return bool(role and role.is_superadmin)


def my_id(user):
    """CommonHelpers::myId()."""
    return getattr(user, "id", None)


def my_role_id(user):
    """CommonHelpers::myPrivilegeId(). Named for the column this port
    actually has -- adm_users.id_adm_role -- since there is no
    adm_privileges table to point at."""
    return getattr(user, "id_adm_role", None)


def my_theme_color(user):
    """CommonHelpers::myThemeColor(). Comes from the user's *role*, not the
    user row -- same as api/serializers.py's user_out()."""
    role = getattr(user, "role", None)
    return role.theme_color if role else None


# --- Capability -------------------------------------------------------
def is_capable(actions, capability) -> bool:
    """Is `capability` switched on in a module's `actions` declaration?

    Present and truthy, with no default-true fallback -- a key that is
    simply absent is OFF. A descriptor such as
    {"label": "Edit", "icon": "pencil"} is truthy, which is what lets a
    module carry a label and an icon while still enabling the action.

    This deliberately diverges from the Laravel original, whose
    permittedActions() reads `$this->actions['create'] ?? true` and so
    treats a *missing* key as ON. Two things depend on the stricter rule
    here: RolesController omits "create" expecting a 403, and the React
    capable() in GeneratedModulePage.jsx mirrors this exact logic so the UI
    never offers a button the backend would reject.
    """
    return bool((actions or {}).get(capability, False))


def _privilege(user, module_path=None) -> bool:
    """Stands in for the admin_privileges_roles session lookup.

    Laravel walks the caller's privilege rows for one matching
    getModulePath() and returns its is_create/is_edit/... flag. This port
    has no such table, so there is nothing to walk -- see the module
    docstring for the constant that decides the answer instead.
    """
    if is_superadmin(user):
        return True
    return PRIVILEGES_DEFAULT


def is_view(user, module_path=None) -> bool:
    """CommonHelpers::isView() -- the privilege row's is_visible flag."""
    return _privilege(user, module_path)


def is_read(user, module_path=None) -> bool:
    """CommonHelpers::isRead() -- the row's is_read flag. Unused by the
    module system today; kept so the set matches the original."""
    return _privilege(user, module_path)


def is_create(user, module_path=None) -> bool:
    """CommonHelpers::isCreate() -- the row's is_create flag."""
    return _privilege(user, module_path)


def is_update(user, module_path=None) -> bool:
    """CommonHelpers::isUpdate() -- the row's is_edit flag."""
    return _privilege(user, module_path)


def is_delete(user, module_path=None) -> bool:
    """CommonHelpers::isDelete() -- the row's is_delete flag."""
    return _privilege(user, module_path)


def module_access(user, module_path=None) -> dict:
    """GeneratedModuleController::moduleAccess() -- privileges alone, with
    no reference to the module's own config.

    Note the key names: `update`, not `edit`. That matches both the Laravel
    original and the moduleAccess prop GeneratedModulePage.jsx reads, which
    is why permitted_actions() below has to translate between the two.
    """
    return {
        "view": is_view(user, module_path),
        "create": is_create(user, module_path),
        "update": is_update(user, module_path),
        "delete": is_delete(user, module_path),
    }


def _permit(actions, capability, allowed):
    """Resolve one capability, keeping its declaration intact when it survives.

    The Laravel original writes `$access['create'] && ($this->actions['create'] ?? true)`,
    and PHP's && yields a plain bool -- which throws away a descriptor like
    {"label": "Edit", "icon": "pencil"}. RolesController declares exactly
    that, and GeneratedModulePage.jsx reads it back through descriptor() to
    pick each button's glyph, so flattening here would silently drop every
    custom icon. Returning the declaration itself keeps both halves: still
    truthy, still carrying its label.
    """
    if not (allowed and is_capable(actions, capability)):
        return False
    return (actions or {}).get(capability)


def permitted_actions(actions, user, module_path=None) -> dict:
    """GeneratedModuleController::permittedActions() -- the module's own
    declaration ANDed with the caller's privileges. This is what ships to
    the browser as `actions`.

    The three write capabilities are gated both ways; `view` follows the
    module's declaration alone, as it does upstream. Any other key a module
    invented is passed through untouched.
    """
    access = module_access(user, module_path)
    resolved = dict(actions or {})
    resolved["view"] = _permit(actions, "view", True)
    resolved["create"] = _permit(actions, "create", access["create"])
    resolved["edit"] = _permit(actions, "edit", access["update"])
    resolved["delete"] = _permit(actions, "delete", access["delete"])
    return resolved


def deny(message="Denied access."):
    """The 403 every capability check raises. One place, so the wording
    cannot drift between call sites."""
    raise HTTPException(status_code=403, detail=message)


# --- Timestamps -------------------------------------------------------
def now():
    """One clock for every write. Laravel gets created_at/updated_at from
    Eloquent's $timestamps; nothing here does it automatically, so the
    module base class stamps them by hand."""
    return datetime.utcnow()


def stamp_created(payload, enabled=True):
    """Adds created_at when the module declares has_created_at."""
    if enabled:
        payload["created_at"] = now()
    return payload


def stamp_updated(payload, enabled=True):
    """Adds updated_at when the module declares has_updated_at."""
    if enabled:
        payload["updated_at"] = now()
    return payload
