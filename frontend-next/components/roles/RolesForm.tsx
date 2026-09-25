"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/http";
import { errorMessage, fieldErrors } from "@/lib/api-errors";
import { showToast } from "@/context/toastContext";
import { useAuth } from "@/context/authContext";
import { useTheme } from "@/context/ThemeContext";
import useThemeStyles from "@/hooks/useThemeStyles";
import { namedThemeOptions } from "@/config/themeOptions";
import Card from "@/components/form/Card";
import InputLabel from "@/components/form/InputLabel";
import TextInput from "@/components/form/TextInput";
import SelectInput from "@/components/form/SelectInput";
import Checkbox from "@/components/form/Checkbox";
import InputError from "@/components/form/InputError";

type RoleValues = { name: string; is_superadmin: number; theme_color: string };

const BLANK_ROLE: RoleValues = { name: "", is_superadmin: 0, theme_color: "" };

const PERMISSION_COLUMNS = [
  { key: "is_visible", label: "View" },
  { key: "is_create", label: "Create" },
  { key: "is_read", label: "Read" },
  { key: "is_edit", label: "Update" },
  { key: "is_delete", label: "Delete" },
  { key: "is_void", label: "Void" },
  { key: "is_override", label: "Override" },
] as const;
type PermissionKey = (typeof PERMISSION_COLUMNS)[number]["key"];
const PERMISSIONS = PERMISSION_COLUMNS.map((c) => c.key);
const COLUMN_TINTS = ["bg-blue-100", "bg-yellow-100", "bg-indigo-100", "bg-green-100", "bg-orange-200", "bg-red-300", "bg-green-200"];

const THEME_OPTIONS = namedThemeOptions.map(({ id, name }) => ({ value: id, label: name }));

// RolesController.get_module() returns every non-protected module with this
// role's flags flat on the row; a flag is null when no privilege row exists yet.
type ModulePermission = { id: number; name: string } & Partial<Record<PermissionKey, number | null>>;
type SaveResponse = { message?: string; status?: "success" | "error" };

// Shared by /roles/add and /roles/edit/[id]. The edit route passes the id
// from its URL segment; the legacy app derived the same from ModuleRoute's
// action/args props.
export default function RoleForm({ id }: { id?: string }) {
  const { user, refreshUser } = useAuth();
  const isEdit = Boolean(id);

  const router = useRouter();
  const { theme } = useTheme();
  const { textColor, bgColor, hoverBgColor } = useThemeStyles(theme);

  const [values, setValues] = useState<RoleValues>(BLANK_ROLE);
  const [modules, setModules] = useState<ModulePermission[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
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
          isEdit ? api.get<{ editRow?: Partial<RoleValues> }>(`/roles/edit/${id}`) : Promise.resolve(null),
          api.get<ModulePermission[]>(isEdit ? `/roles/module/${id}` : "/roles/module"),
        ]);
        if (cancelled) return;
        const role = roleRes?.data?.editRow;
        // Keep only the editable fields; editRow also carries list metadata.
        if (role) {
          setValues({
            name: role.name ?? "",
            is_superadmin: Number(role.is_superadmin) === 1 ? 1 : 0,
            theme_color: role.theme_color ?? "",
          });
        }
        setModules(moduleRes.data ?? []);
        setShowPriv(Number(role?.is_superadmin) !== 1);
      } catch {
        if (!cancelled) showToast("Could not load the form.", "danger");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, id]);

  // The "select all" column checkboxes follow the module rows; derived on
  // render rather than mirrored into state by an effect.
  const selectAll = Object.fromEntries(
    PERMISSIONS.map((p) => [p, modules.length > 0 && modules.every((m) => m[p] === 1)])
  ) as Record<PermissionKey, boolean>;

  const set = <K extends keyof RoleValues>(field: K) => (next: RoleValues[K]) =>
    setValues((prev) => ({ ...prev, [field]: next }));

  // Apply one permission column across every module row at once
  const toggleColumn = (permission: PermissionKey, checked: number) => {
    setModules((prev) => prev.map((m) => ({ ...m, [permission]: checked ? 1 : 0 })));
  };

  // Toggle a single permission on a single module row
  const togglePermission = (moduleId: number, permission: PermissionKey, checked: number) => {
    setModules((prev) =>
      prev.map((m) => (m.id === moduleId ? { ...m, [permission]: checked ? 1 : 0 } : m))
    );
  };

  // Toggle every permission for one module row at once
  const toggleRow = (moduleId: number, checked: number) => {
    setModules((prev) =>
      prev.map((m) =>
        m.id === moduleId
          ? { ...m, ...Object.fromEntries(PERMISSIONS.map((p) => [p, checked ? 1 : 0])) }
          : m
      )
    );
  };

  const buildPermissionsPayload = () =>
    Object.fromEntries(
      modules.map((m) => [m.id, Object.fromEntries(PERMISSIONS.map((p) => [p, m[p] ? 1 : 0]))])
    );

  // Card's Save button sends a click and the form sends a submit; both work.
  const submit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const payload = { ...values, permissions: buildPermissionsPayload() };
      const res = isEdit
        ? await api.post<SaveResponse>("/roles/update", { ...payload, id })
        : await api.post<SaveResponse>("/roles/store", payload);

      // Saving your own role can change your theme; reload identity so the
      // palette updates without a page refresh.
      if (isEdit && String(user?.role_id) === String(id)) {
        try {
          await refreshUser();
        } catch {
          showToast("Role saved. Reload the page to refresh your theme.", "danger");
          router.push("/roles");
          return;
        }
      }
      showToast(res.data?.message || "Saved.", res.data?.status || "success");
      router.push("/roles");
    } catch (err) {
      setErrors(fieldErrors(err));
      showToast(errorMessage(err, "Could not save."), "danger");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="text-[13px] text-skin-dim">Loading…</p>;

  return (
    <Card
      href="/roles"
      withButton
      iconClass="fa fa-crown"
      onClick={submit}
      loading={busy}
      headerName={isEdit ? "Edit Role" : "Add Role"}
      marginBottom={4}
    >
      <form onSubmit={submit}>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
          <label className="m-0 flex flex-col gap-1.5 text-[13px] text-skin-dim">
            <InputLabel value="Role" required />
            <TextInput value={values.name} maxLength={255} onChange={(e) => set("name")(e.target.value)} />
            <InputError message={errors.name} />
          </label>

          <label className="m-0 flex flex-col gap-1.5 text-[13px] text-skin-dim">
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

          <label className="m-0 flex flex-col gap-1.5 text-[13px] text-skin-dim">
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
                          checked={PERMISSIONS.every((p) => modul[p] === 1)}
                          onChange={(next) => toggleRow(modul.id, next)}
                        />
                      </td>
                      {PERMISSION_COLUMNS.map(({ key }, i) => (
                        <td key={key} className={`px-6 py-4 whitespace-nowrap text-center ${COLUMN_TINTS[i]}`}>
                          <Checkbox
                            checked={modul[key] === 1}
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
