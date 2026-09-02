from app import models
from app.seeders.base import Seeder
from app.seeders.registry import seeder


@seeder
class RolesSeeder(Seeder):
    order = 10
    description = "adm_roles -- the Super Administrator role"

    # Add a row here to seed another role. is_superadmin is what
    # common_helpers reads to bypass privilege checks, so keep it 0 for
    # anything that is not a real superadmin.
    ROLES = [
        {"name": "Super Administrator", "is_superadmin": 1, "theme_color": None},
    ]

    def run(self, db):
        for spec in self.ROLES:
            existing = (
                db.query(models.Role)
                .filter(models.Role.name == spec["name"])
                .first()
            )
            if existing:
                self.skipped(spec["name"])
                continue

            db.add(models.Role(**spec))
            self.created(spec["name"])

        db.commit()
