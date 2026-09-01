# The admin console's static routes, one file per feature area.
#
# Mirrors the Laravel original's app/Http/Controllers/Admin/ (at
# C:/laragon/www/vram), where auth, dashboard and the admin screens are
# each their own folder of controllers.
#
# Deliberately NOT in here: api/dynamic.py, api/routers.py and
# api/serializers.py stay one level up. dynamic.py is the catch-all module
# router and belongs to no single feature area; routers.py combines these
# files rather than being one of them; serializers.py is shared by auth.py
# and admin.py both.
#
# Nothing is re-exported -- routers.py imports each submodule by name, so
# a router that is never included stays obvious.
