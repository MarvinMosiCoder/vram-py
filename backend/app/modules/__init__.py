# Importing this package registers every controller. A new module file
# needs a line here or it will 500 with "unregistered controller".
from app.modules import roles_module  # noqa: F401
from app.modules import users_module  # noqa: F401