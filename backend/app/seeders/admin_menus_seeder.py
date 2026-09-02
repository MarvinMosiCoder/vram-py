"""adm_admin_menuses -- the rows GET /admin_sidebar returns.

Nothing seeded this table before either, so a freshly migrated database had
an empty sidebar. Pairs with ModulesSeeder: a module with no menu row is
reachable but invisible, a menu row with no module is a link that 404s.

**The slug/path coupling.** AppSidebar.jsx builds each link from this
table's `slug`, while api/dynamic.py resolves the module by `path` in
adm_modules. There is no foreign key between the two tables and nothing
validates the pair at runtime -- a mismatch is a sidebar link that 404s with
both rows looking perfectly correct. docs/MODULES.md calls it the sharpest
footgun in the system, so run() below checks the pairing while it has both
tables in front of it.
"""
from app import models
from app.seeders.base import Seeder
from app.seeders.registry import seeder


@seeder
class AdminMenusSeeder(Seeder):
    order = 40  # after ModulesSeeder, so the slug check has rows to check against
    description = "adm_admin_menuses -- the admin sidebar entries"

    # `slug` must equal the module's `path`. `parent_id` is NULL for a
    # top-level entry, or another row's id for an accordion child (the
    # frontend renders flat today, but the column is returned).
    MENUS = [
        {
            "name": "Roles",
            "type": "Module",
            "path": "roles",
            "slug": "roles",
            "icon": "fa fa-key",
            "color": None,
            "parent_id": None,
            "is_active": 1,
            "sorting": 1,
        },
        {
            "name": "Menus",
            "type": "Module",
            "path": "menus",
            "slug": "menus",
            "icon": "fa fa-bars",
            "color": None,
            "parent_id": None,
            "is_active": 1,
            "sorting": 2,
        },
    ]

    def run(self, db):
        module_paths = {
            path for (path,) in db.query(models.Modules.path)
            .filter(models.Modules.is_active == 1).all()
        }

        for spec in self.MENUS:
            # Only meaningful for module-backed entries; a URL or Route type
            # points somewhere else and has no adm_modules row to match.
            if spec["type"] == "Module" and spec["slug"] not in module_paths:
                raise RuntimeError(
                    "Menu '%s' has slug '%s', but no active adm_modules row "
                    "has that path. The sidebar link would 404. Seed the "
                    "module first, or fix the slug."
                    % (spec["name"], spec["slug"])
                )

            existing = (
                db.query(models.AdminMenuses)
                .filter(models.AdminMenuses.slug == spec["slug"])
                .first()
            )
            if existing:
                self.skipped(spec["slug"])
                continue

            db.add(models.AdminMenuses(**spec))
            self.created(spec["slug"])

        db.commit()
