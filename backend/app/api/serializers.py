from app import models, schemas

# Shared across auth.py and admin.py — both need to turn a User row into
# the public UserOut shape, so it lives here instead of being duplicated.


def user_out(user: models.User) -> schemas.UserOut:
    return schemas.UserOut(
        id=user.id,
        email=user.email,
        name=user.name,
        theme_color=user.role.theme_color if user.role else None,
        role=user.role.name if user.role else None,
        role_id=user.id_adm_role,
        is_superadmin=bool(user.role.is_superadmin) if user.role else False,
    )
