# The admin domain's module controllers -- one file per module that needs
# real behaviour. A module that only declares metadata needs no file here at
# all: it lives entirely in its adm_modules row and is served by
# DataDrivenModuleController.
#
# There is no import list. Dropping a *_module.py in this folder registers
# it, because registry.discover() scans this package -- see that function
# for why the scan is not simply a loop in this file.
