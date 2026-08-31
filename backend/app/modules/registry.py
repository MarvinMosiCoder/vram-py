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
