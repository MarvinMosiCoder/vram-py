"""adm_modules -- the rows that make a module reachable at all.

Nothing seeded this table before, so a freshly migrated database had no
modules: every /<path> answered 404 even though the controller class was
registered and sitting right there. See docs/MODULES.md "Adding a module".

`controller` must match a @controller("...") string exactly -- the
CONTROLLERS dict is the allowlist, and a name nobody registered is a 500,
not a 404. run() checks that before inserting, so a typo here fails at seed
time with a clear message instead of at request time with a confusing one.
"""
from app import models
from app.seeders.base import Seeder
from app.seeders.registry import seeder


@seeder
class ModulesSeeder(Seeder):
    order = 30
    description = "adm_modules -- the built-in Roles and Menus modules"

    # path must match ^[a-z0-9_-]+$ (MODULE_PATH_RE in api/dynamic.py).
    # is_protected marks a built-in module rather than a user-generated one;
    # it is NOT a permission flag.
    MODULES = [
        {
            "name": "Roles",
            "icon": "fa fa-key",
            "path": "roles",
            "table_name": "adm_roles",
            "controller": "RolesController",
            "is_active": 1,
            "is_protected": 1,
        },
        {
            "name": "Menus",
            "icon": "fa fa-bars",
            "path": "menus",
            "table_name": "adm_admin_menuses",
            "controller": "MenusController",
            "is_active": 1,
            "is_protected": 1,
        },
    ]

    def run(self, db):
        from app.modules.registry import CONTROLLERS, discover

        discover()  # fill CONTROLLERS so the check below is meaningful

        for spec in self.MODULES:
            if spec["controller"] not in CONTROLLERS:
                raise RuntimeError(
                    "Module '%s' names controller '%s', which no file in "
                    "app/modules/admin/ registers. Seeding it would give a "
                    "500 on every request to /%s."
                    % (spec["name"], spec["controller"], spec["path"])
                )

            existing = (
                db.query(models.Modules)
                .filter(models.Modules.path == spec["path"])
                .first()
            )
            if existing:
                self.skipped(spec["path"])
                continue

            db.add(models.Modules(**spec))
            self.created(spec["path"])

        db.commit()
