"""
Run this once after installing dependencies:
    python seed.py

Creates the three roles and one admin login so you have something
to test with immediately: admin@vram.com / admin123
"""
from app.core.database import Base, engine, SessionLocal
from app import models
from app.core import auth

Base.metadata.create_all(bind=engine)
db = SessionLocal()

role_names = ["admin", "editor", "viewer"]
roles = {}
for name in role_names:
    role = db.query(models.Role).filter(models.Role.name == name).first()
    if not role:
        role = models.Role(name=name)
        db.add(role)
        db.commit()
        db.refresh(role)
    roles[name] = role

existing_admin = db.query(models.User).filter(models.User.email == "admin@vram.com").first()
if not existing_admin:
    admin_user = models.User(
        email="admin@vram.com",
        hashed_password=auth.hash_password("admin123"),
        role_id=roles["admin"].id,
    )
    db.add(admin_user)
    db.commit()
    print("Created roles: admin, editor, viewer")
    print("Created admin login -> email: admin@vram.com  password: admin123")
else:
    print("Roles/admin already exist — nothing to do.")

db.close()
