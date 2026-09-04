import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../api";
import { useOptionalToast } from "../../../context/ToastContext";
import Card from "../../../components/form/Card";
import InputLabel from "../../../components/form/InputLabel";
import TextInput from "../../../components/form/TextInput";
import SelectInput from "../../../components/form/SelectInput";
import InputError from "../../../components/form/InputError";

const BLANK_USER = { name: "", email: "", id_adm_role: "", password: "" };

// Shared by add.jsx and edit.jsx, same split as roles/role-form.jsx -- NOT a
// page itself (named export, no default), so modulePages.js's glob (which
// only registers a file whose default export is a function) skips it.
// `action`/`args` come from ModuleRoute, exactly like every other module
// page in this project.
export function UserForm({ action, args = [] }) {
  const isEdit = action === "edit";
  const [id] = args;

  const navigate = useNavigate();
  const toast = useOptionalToast();

  const [values, setValues] = useState(BLANK_USER);
  const [roleOptions, setRoleOptions] = useState([]);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  // One GET, already a real backend action inherited by every generated
  // module: get_add()/get_edit() both return index_props(), which carries
  // formFields -- including id_adm_role's `options`, resolved server-side
  // from adm_roles by resolved_form_fields() -- alongside editRow for the
  // record itself. Mirrors how role-form.jsx loads from /roles/module.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(isEdit ? `/users/edit/${id}` : "/users/add");
        if (cancelled) return;
        const row = res.data?.editRow;
        if (row) setValues({ ...BLANK_USER, ...row, password: "" });
        setRoleOptions(res.data?.formFields?.id_adm_role?.options ?? []);
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
  console.log("roleOptions", roleOptions, values);
  const set = (field) => (next) => setValues((prev) => ({ ...prev, [field]: next }));

  const validate = () => {
    const next = {};
    if (!values.name) next.name = "Name is required.";
    if (!values.email) next.email = "Email is required.";
    if (!values.id_adm_role) next.id_adm_role = "Role is required.";
    // Required on create; on edit, blank just means "keep the current password".
    if (!isEdit && !values.password) next.password = "Password is required.";
    return next;
  };

  const submit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast?.handleToast("Please check the highlighted fields.", "danger");
      return;
    }

    setBusy(true);
    setErrors({});
    try {
      // A blank password must not overwrite the existing one -- post_store()/
      // post_update() drop null/empty values anyway (generated_module.py's
      // payload()), but leaving it out here is one less place relying on that.
      const payload = { ...values };
      if (!payload.password) delete payload.password;

      const res = isEdit
        ? await api.post("/users/update", { ...payload, id })
        : await api.post("/users/store", payload);

      toast?.handleToast(res.data?.message || "Saved.", res.data?.status || "success");
      navigate("/users");
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
      href="/users"
      withButton
      iconClass="fa fa-users"
      onClick={submit}
      loading={busy}
      headerName={isEdit ? "Edit User" : "Add User"}
      marginBottom={4}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <label className="form-field">
            <InputLabel value="Name" required />
            <TextInput value={values.name} maxLength={255} onChange={(e) => set("name")(e.target.value)} />
            <InputError message={errors.name} />
          </label>

          <label className="form-field">
            <InputLabel value="Email" required />
            <TextInput
              type="email"
              value={values.email}
              maxLength={255}
              onChange={(e) => set("email")(e.target.value)}
            />
            <InputError message={errors.email} />
          </label>

          <label className="form-field">
            <InputLabel value="Role" required />
            <SelectInput
              type="react-select"
              value={roleOptions.find((o) => o.value === values.id_adm_role) ?? null}
              options={roleOptions}
              placeholder="Choose a role"
              onChange={(option) => set("id_adm_role")(option ? option.value : "")}
            />
            <InputError message={errors.id_adm_role} />
          </label>

          <label className="form-field">
            <InputLabel value={isEdit ? "New password" : "Password"} required={!isEdit} />
            <TextInput
              type="password"
              value={values.password}
              maxLength={255}
              placeholder={isEdit ? "Leave blank to keep the current password" : undefined}
              onChange={(e) => set("password")(e.target.value)}
            />
            <InputError message={errors.password} />
          </label>
        </div>
      </form>
    </Card>
  );
}
