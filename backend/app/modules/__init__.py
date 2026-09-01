# Controllers live under admin/; the shared base class they inherit is
# app/helpers/generated_module.py, and registry.py beside this file holds
# the CONTROLLERS dict, the @controller / @action decorators, and discover().
#
# This file imports NOTHING on purpose. It used to import the admin package,
# which meant `from app.modules.registry import action` pulled in every
# controller as a side effect -- and controllers import the base class,
# which imports registry, so importing the base class first was a circular
# import. Registration is now an explicit registry.discover() call from
# api/dynamic.py instead.
