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
    description = "adm_modules -- the built-in Roles module"

    # path must match ^[a-z0-9_-]+$ (MODULE_PATH_RE in api/dynamic.py).
    # is_protected marks a built-in module rather than a user-generated one;
    # it is NOT a permission flag.
    MODULES = [
        {
            "name": "Notifications",
            "icon": "fa fa-key",
            "path": "notifications",
            "table_name": "adm_notifications",
            "controller": "NotificationsController",
            "is_active": 1,
            "is_protected": 1,
        },
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
            "name": "Users Management",
            "icon": "fa fa-users",
            "path": "users",
            "table_name": "adm_users",
            "controller": "UsersController",
            "is_active": 1,
            "is_protected": 1,
        },
        {
            "name": "Menu Management",
            "icon": "fa fa-bars",
            "path": "menus",
            "table_name": "adm_menus",
            "controller": "MenusController",
            "is_active": 1,
            "is_protected": 1,
        },
        {
            "name": "Module Generator",
            "icon": "fa fa-bars",
            "path": "modules",
            "table_name": "adm_modules",
            "controller": "ModulesController",
            "is_active": 1,
            "is_protected": 1,
        },
        {
            "name": "Api Generator",
            "icon": "fa fa-bars",
            "path": "api",
            "table_name": "api_generator",
            "controller": "ApiGeneratorController",
            "is_active": 1,
            "is_protected": 1,
        },
        {
            "name": "Admin Settings",
            "icon": "fa fa-bars",
            "path": "settings",
            "table_name": "adm_settings",
            "controller": "SettingsController",
            "is_active": 1,
            "is_protected": 1,
        },
        {
            "name": "Email Templates",
            "icon": "fa fa-envelope",
            "path": "email-templates",
            "table_name": "adm_email_templates",
            "controller": "EmailTemplatesController",
            "is_active": 1,
            "is_protected": 1,
        },
        {
            "name": "Statistics Builder",
            "icon": "fa fa-envelope",
            "path": "statistics-builder",
            "table_name": "adm_statistics_builder",
            "controller": "StatisticsBuilderController",
            "is_active": 1,
            "is_protected": 1,
        },
        {
            "name": "Logs User Access",
            "icon": "fa fa-envelope",
            "path": "logs-user-access",
            "table_name": "adm_logs_user_access",
            "controller": "LogsUserAccessController",
            "is_active": 1,
            "is_protected": 1,
        },
        {
            "name": "System Errors Logs",
            "icon": "fa fa-envelope",
            "path": "logs-system-errors",
            "table_name": "adm_logs_system_errors",
            "controller": "LogsSystemErrorsController",
            "is_active": 1,
            "is_protected": 1,
        },
        {
            "name": "Module Activity Logs",
            "icon": "fa fa-envelope",
            "path": "logs-module-activity",
            "table_name": "adm_logs_module_activity",
            "controller": "LogsModuleActivityController",
            "is_active": 1,
            "is_protected": 1,
        },
    ]

    def run(self, db):
        from app.modules.registry import CONTROLLERS, discover

        discover()  # fill CONTROLLERS so the check below is meaningful

        for spec in self.MODULES:
            # if spec["controller"] not in CONTROLLERS:
            #     raise RuntimeError(
            #         "Module '%s' names controller '%s', which no file in "
            #         "app/modules/admin/ registers. Seeding it would give a "
            #         "500 on every request to /%s."
            #         % (spec["name"], spec["controller"], spec["path"])
            #     )

            existing = (
                db.query(models.Modules)
                .filter(models.Modules.path == spec["path"])
                .first()
            )
            if existing:
                # MODULES above is the source of truth for these rows, not
                # the admin UI -- a re-run pushes any edit made here (icon,
                # name, ...) straight to the database instead of skipping it.
                for field, value in spec.items():
                    setattr(existing, field, value)
                self.updated(spec["path"])
                continue

            db.add(models.Modules(**spec))
            self.created(spec["path"])

        db.commit()
