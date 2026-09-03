import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../api";
import { useOptionalToast } from "../../../context/ToastContext";
import { useTheme } from "../../../context/ThemeContext";
import useThemeStyles from "../../../hooks/useThemeStyles";
import { legacyThemeOptions } from "../../../config/themeOptions";
import Card from "../../../components/form/Card";
import InputLabel from "../../../components/form/InputLabel";
import TextInput from "../../../components/form/TextInput";
import SelectInput from "../../../components/form/SelectInput";
import Checkbox from "../../../components/form/Checkbox";
import InputError from "../../../components/form/InputError";

const BLANK_ROLE = { name: "", is_superadmin: 0, theme_color: "" };

const PERMISSION_COLUMNS = [
  { key: "is_visible", label: "View" },
  { key: "is_create", label: "Create" },
  { key: "is_read", label: "Read" },
  { key: "is_edit", label: "Update" },
  { key: "is_delete", label: "Delete" },
  { key: "is_void", label: "Void" },
  { key: "is_override", label: "Override" },
];
const PERMISSIONS = PERMISSION_COLUMNS.map((c) => c.key);
const COLUMN_TINTS = ["bg-blue-100", "bg-yellow-100", "bg-indigo-100", "bg-green-100", "bg-orange-200", "bg-red-300", "bg-green-200"];

const THEME_OPTIONS = legacyThemeOptions.map(({ id, name }) => ({ value: id, label: name }));

// Shared by add.jsx and edit.jsx -- NOT a page itself (named export, no
// default), so modulePages.js's glob (which only registers a file whose
// default export is a function) skips it. `action`/`args` come from
// ModuleRoute, exactly like every other module page in this project --
// NOT `moduleses`/`row` props, which nothing in this SPA ever supplies
// (those were the Laravel/Inertia original's server-pushed props).
export function RoleForm({ action, args = [] }) {
  const isEdit = action === "edit";
  const [id] = args;

  const navigate = useNavigate();
  const toast = useOptionalToast();
  const { theme } = useTheme();
  const { textColor, bgColor, hoverBgColor } = useThemeStyles(theme);

  const [values, setValues] = useState(BLANK_ROLE);
  const [modules, setModules] = useState([]);
  const [selectAll, setSelectAll] = useState({});
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPriv, setShowPriv] = useState(true);

  // Two independent GETs, both already real backend actions:
  //   - /roles/edit/<id>   -- inherited get_edit(), the role's own fields
  //   - /roles/module[/id] -- RolesController.get_module(), every non-protected
  //     module plus this role's flags (role_id=0 when adding, so every flag
  //     comes back blank -- there's no row yet to join against)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [roleRes, moduleRes] = await Promise.all([
          isEdit ? api.get(`/roles/edit/${id}`) : Promise.resolve(null),
          api.get(isEdit ? `/roles/module/${id}` : "/roles/module"),
        ]);
        if (cancelled) return;
        const role = roleRes?.data?.editRow;
        if (role) setValues({ ...BLANK_ROLE, ...role });
        setModules(moduleRes.data ?? []);
        setShowPriv(!(role?.is_superadmin == 1));
      } catch {
        if (!cancelled) toast?.handleToast("Could not load the form.", "danger");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, id]);

  // Keep the "select all" column checkboxes in sync with the module rows.
  // get_module() returns the flags FLAT on each row (m.is_visible, ...),
  // not nested under m.roles like the Laravel original.
  useEffect(() => {
    setSelectAll(
      PERMISSIONS.reduce((acc, perm) => {
        acc[perm] = modules.length > 0 && modules.every((m) => m[perm] == 1);
        return acc;
      }, {})
    );
  }, [modules]);

  const set = (field) => (next) => setValues((prev) => ({ ...prev, [field]: next }));

  // Apply one permission column across every module row at once
  const toggleColumn = (permission, checked) => {
    setModules((prev) => prev.map((m) => ({ ...m, [permission]: checked ? 1 : 0 })));
  };

  // Toggle a single permission on a single module row
  const togglePermission = (moduleId, permission, checked) => {
    setModules((prev) =>
      prev.map((m) => (m.id === moduleId ? { ...m, [permission]: checked ? 1 : 0 } : m))
    );
  };

  // Toggle every permission for one module row at once
  const toggleRow = (moduleId, checked) => {
    setModules((prev) =>
      prev.map((m) =>
        m.id === moduleId
          ? { ...m, ...PERMISSIONS.reduce((acc, p) => ({ ...acc, [p]: checked ? 1 : 0 }), {}) }
          : m
      )
    );
  };

  const buildPermissionsPayload = () =>
    modules.reduce((acc, m) => {
      acc[m.id] = PERMISSIONS.reduce((flags, p) => ({ ...flags, [p]: m[p] ? 1 : 0 }), {});
      return acc;
    }, {});

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
        const payload = { ...values, permissions: buildPermissionsPayload() };
        const res = isEdit
        ? await api.post("/roles/update", { ...payload, id })
        : await api.post("/roles/store", payload);

        toast?.handleToast(res.data?.message || "Saved.", res.data?.status || "success");
        navigate("/roles");
    } catch (err) {
        const detail = err.response?.data?.detail;
        if (detail && typeof detail === "object" && !Array.isArray(detail)) {
        setErrors(detail);
        toast?.handleToast("Please check the highlighted fields.", "danger");
        } else {
        toast?.handleToast(typeof detail === "string" ? detail : "Could not save.", "danger");
        }
    } finally {
        setBusy(false);
    }
  };


  if (loading) return <p className="muted">Loading…</p>;

  return (
    <Card
      href="/roles"
      withButton
      iconClass="fa fa-crown"
      onClick={submit}
      loading={busy}
      theme={theme}
      headerName={isEdit ? "Edit Role" : "Add Role"}
      marginBottom={4}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <label className="form-field">
            <InputLabel value="Role" required />
            <TextInput value={values.name} maxLength={255} onChange={(e) => set("name")(e.target.value)} />
            <InputError message={errors.name} />
          </label>

          <label className="form-field">
            <InputLabel value="Superadmin" />
            <Checkbox
              checked={values.is_superadmin}
              onChange={(next) => {
                set("is_superadmin")(next);
                setShowPriv(!next);
              }}
            />
            <InputError message={errors.is_superadmin} />
          </label>

          <label className="form-field">
            <InputLabel value="Theme" />
            <SelectInput
              value={values.theme_color}
              options={THEME_OPTIONS}
              placeholder="Choose a theme"
              onChange={(e) => set("theme_color")(e.target.value)}
            />
            <InputError message={errors.theme_color} />
          </label>
        </div>

        {showPriv && (
          <div className="mt-4 font-medium">
            <p className={`text-sm ${textColor}`}>Privileges Configuration</p>
            <div className={`overflow-x-auto mt-5 ${bgColor}`}>
              <table className="min-w-full divide-y divide-gray-300">
                <thead>
                  <tr>
                    <th className={`px-6 py-3 ${bgColor} ${textColor} text-left text-xs font-medium uppercase tracking-wider`}>No</th>
                    <th className={`px-6 py-3 ${bgColor} ${textColor} text-left text-xs font-medium uppercase tracking-wider`}>Module Name</th>
                    <th className={`px-6 py-3 ${bgColor} ${textColor} text-center text-xs font-medium uppercase tracking-wider`}>All</th>
                    {PERMISSION_COLUMNS.map(({ key, label }) => (
                      <th key={key} className={`px-6 py-3 ${bgColor} ${textColor} text-center text-xs font-medium uppercase tracking-wider`}>
                        <div className="flex flex-col items-center">
                          <span>{label}</span>
                          <Checkbox checked={selectAll[key]} onChange={(next) => toggleColumn(key, next)} />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className={`${bgColor} divide-y divide-gray-300`}>
                  {modules.map((modul, index) => (
                    <tr key={modul.id} className={`${hoverBgColor} transition-colors`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{index + 1}</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${textColor}`}>{modul.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <Checkbox
                          checked={PERMISSIONS.every((p) => modul[p] == 1)}
                          onChange={(next) => toggleRow(modul.id, next)}
                        />
                      </td>
                      {PERMISSION_COLUMNS.map(({ key }, i) => (
                        <td key={key} className={`px-6 py-4 whitespace-nowrap text-center ${COLUMN_TINTS[i]}`}>
                          <Checkbox
                            checked={modul[key] == 1}
                            onChange={(next) => togglePermission(modul.id, key, next)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </form>
    </Card>
  );
}
