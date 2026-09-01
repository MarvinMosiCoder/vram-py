# Maps adm_modules.controller (a string from the database) to a real class.
# This dict IS the allowlist — a controller not registered here can never
# be reached, no matter what someone types into adm_modules.
CONTROLLERS: dict[str, type] = {}


def controller(name: str):
    """Class decorator. @controller("UsersController") registers the class
    under the exact string stored in adm_modules.controller."""
    def decorator(cls):
        CONTROLLERS[name] = cls
        return cls
    return decorator


def action(fn):
    """Method decorator. Marks a method as reachable over HTTP.

    Laravel reflects over *public* methods; Python has no `public` keyword,
    so an unguarded getattr() on a user-supplied name would reach any
    attribute on the object. This decorator is that missing keyword.
    """
    fn.__module_action__ = True
    return fn


CONTROLLER_SUFFIX = "_module"


def discover(package_name: str = "app.modules.admin") -> dict:
    """Import every controller file in `package_name`, registering each.

    THE FILESYSTEM IS THE REGISTRY. There used to be a hand-written import
    line per controller in app/modules/admin/__init__.py, which carried no
    information: importing a file is what runs its @controller decorator,
    and Python has no autoloader, so the list existed only to trigger the
    imports. Forget a line and the module 500s with "unregistered
    controller" while its class sits right there.

    The Laravel original has no such step -- routes/web.php filters
    adm_modules rows through glob('Controllers/Admin/*.php') and resolves
    the class by name via PSR-4. This is both halves: iter_modules is the
    glob, import_module is the autoload.

    Deliberately a FUNCTION rather than a loop in the package's __init__.
    Scanning at package-import time makes `from app.modules.registry import
    action` drag in every controller as a side effect -- and since those
    controllers import the base class, which imports this module, that is a
    circular import waiting for someone to import the base class first.
    Calling this explicitly, after imports have settled, has no such
    ordering hazard.
    """
    import importlib
    import pkgutil

    package = importlib.import_module(package_name)
    for info in pkgutil.iter_modules(package.__path__):
        # Only *_module.py. The folder also holds module_generator.py, which
        # is tooling rather than a controller -- importing it here would work
        # but would say the wrong thing, and any future helper dropped
        # alongside the controllers would be imported as if it were one.
        # Laravel's glob('*.php') needs no such filter because its generator
        # lives in Controllers/Admin/ as a real controller.
        if not info.name.endswith(CONTROLLER_SUFFIX):
            continue
        importlib.import_module(f"{package_name}.{info.name}")
    return CONTROLLERS
