"""
Run this once after installing dependencies:
    python seed.py

Creates the roles listed in role_names below and one admin login so
you have something to test with immediately: admin@vram.com / admin123
"""
from app.core.database import Base, engine, SessionLocal
from app import models
from app.core import auth

Base.metadata.create_all(bind=engine)
db = SessionLocal()

role_names = ["Super Administrator"]
admin_role_name = role_names[0]

roles = {}
for name in role_names:
    role = db.query(models.Role).filter(models.Role.name == name).first()
    if not role:
        role = models.Role(name=name, is_superadmin=1 if name == admin_role_name else 0)
        db.add(role)
        db.commit()
        db.refresh(role)
    roles[name] = role

admin_user = db.query(models.User).filter(models.User.email == "admin@vram.com").first()
if not admin_user:
    admin_user = models.User(
        email="admin@vram.com",
        password=auth.hash_password("admin123"),
        id_adm_role=roles[admin_role_name].id,
    )
    db.add(admin_user)
    db.commit()
    print(f"Created roles: {', '.join(role_names)}")
    print("Created admin login -> email: admin@vram.com  password: admin123")
elif admin_user.id_adm_role is None:
    admin_user.id_adm_role = roles[admin_role_name].id
    db.commit()
    print("Backfilled admin's id_adm_role.")
else:
    print("Roles/admin already exist — nothing to do.")

db.close()
