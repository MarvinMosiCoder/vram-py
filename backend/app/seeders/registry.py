# Maps a seeder's name to its class. Same shape, and the same reasoning, as
# app/modules/registry.py: the dict is filled by importing the files, and
# discover() is what does the importing.
SEEDERS: dict[str, type] = {}


def seeder(cls):
    """Class decorator. Registers a Seeder subclass under its class name,
    which is also the name `python seed.py <Name>` takes."""
    SEEDERS[cls.__name__] = cls
    return cls


SEEDER_SUFFIX = "_seeder"


def discover(package_name: str = "app.seeders") -> dict:
    """Import every *_seeder.py in `package_name`, registering each.

    THE FILESYSTEM IS THE REGISTRY -- the same rule the module system uses
    (see app/modules/registry.py). Dropping a new `<name>_seeder.py` in this
    folder is the whole registration step; there is no list to keep in sync,
    which is what Laravel's DatabaseSeeder::call([...]) array would be.

    Ordering is not filesystem order: run_all() sorts by each class's
    `order`, so a seeder that depends on another's rows says so with a
    number rather than by being imported at the right moment.
    """
    import importlib
    import pkgutil

    package = importlib.import_module(package_name)
    for info in pkgutil.iter_modules(package.__path__):
        # Only *_seeder.py, so base.py/registry.py and any future helper
        # dropped alongside them are not mistaken for seeders.
        if not info.name.endswith(SEEDER_SUFFIX):
            continue
        importlib.import_module(f"{package_name}.{info.name}")
    return SEEDERS


def ordered() -> list[type]:
    """Every registered seeder, in the order they should run."""
    return sorted(SEEDERS.values(), key=lambda cls: (cls.order, cls.__name__))
