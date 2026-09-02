"""Database seeders.

Each `<name>_seeder.py` in this folder declares one `Seeder` subclass
decorated with `@seeder`. Dropping the file in is the registration step --
see registry.discover(). Run them with `python seed.py` from backend/.
"""
from app.seeders.base import Seeder
from app.seeders.registry import SEEDERS, discover, ordered, seeder

__all__ = ["Seeder", "SEEDERS", "discover", "ordered", "seeder"]
