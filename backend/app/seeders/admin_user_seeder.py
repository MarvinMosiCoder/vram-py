from app import models
from app.core import auth
from app.seeders.base import Seeder
from app.seeders.registry import seeder


@seeder
class AdminUserSeeder(Seeder):
    order = 20  # after RolesSeeder -- id_adm_role is an FK into adm_roles
    description = "adm_users -- the admin@vram.com login"

    EMAIL = "admin@vram.com"
    PASSWORD = "admin123"
    NAME = "Administrator"
    ROLE_NAME = "Super Administrator"

    def run(self, db):
        role = (
            db.query(models.Role)
            .filter(models.Role.name == self.ROLE_NAME)
            .first()
        )
        if role is None:
            raise RuntimeError(
                "No '%s' role -- run RolesSeeder first (it has a lower "
                "`order`, so a plain `python seed.py` already does)."
                % self.ROLE_NAME
            )

        user = (
            db.query(models.User)
            .filter(models.User.email == self.EMAIL)
            .first()
        )

        if user is None:
            db.add(models.User(
                name=self.NAME,
                email=self.EMAIL,
                password=auth.hash_password(self.PASSWORD),
                id_adm_role=role.id,
                token_version=0,
            ))
            self.created("%s / %s" % (self.EMAIL, self.PASSWORD))
        elif user.id_adm_role is None:
            # Backfill: the account predates the role existing.
            user.id_adm_role = role.id
            self.created("%s (backfilled role)" % self.EMAIL)
        else:
            self.skipped(self.EMAIL)

        db.commit()
