import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../api";
import { useOptionalToast } from "../../../context/ToastContext";
import ContentPanel from "../../../components/panel/ContentPanel";
import PrimaryButton from "../../../components/button/PrimaryButton";
import SecondaryButton from "../../../components/button/SecondaryButton";
import InputLabel from "../../../components/form/InputLabel";
import TextInput from "../../../components/form/TextInput";
import Checkbox from "../../../components/form/Checkbox";
import InputError from "../../../components/form/InputError";

// A CUSTOM create page, replacing the runtime's built-in create panel.
//
// This file's NAME is the whole registration: modulePages.js globs
// pages/modules/**, so "roles/add.jsx" claims the key "roles/add", and
// ModuleRoute resolves most-specific-first -- "roles/add" beats "roles".
// The moment this file exists, /roles/add stops rendering
// GeneratedModulePage and renders this instead. Delete it and the built-in
// panel comes back. Nothing in App.jsx or modulePages.js changes either way.
//
// Reached from the "Add Role" toolbar button declared in
// roles_module.py's custom_index_buttons ({"url": "/roles/add"}).
//
// There is deliberately NO GET here. RolesController.get_add() exists and
// would answer /roles/add, but it returns the entire index payload -- the
// row list, pagination, every column -- because the built-in panel renders
// on top of the table. A standalone page needs none of that. Fetch only if
// the form needs server data (a dropdown's options, say), and give it its
// own lean @action rather than reusing get_add().
export default function RolesAdd() {
  const navigate = useNavigate();
  const toast = useOptionalToast();

  // form_fields lives on the controller for the generic runtime's benefit.
  // A custom page does not read it -- owning the markup is the point, so
  // the fields are spelled out here and the two are free to diverge.
  const [values, setValues] = useState({
    name: "",
    is_superadmin: 0,   // 1/0, not true/false -- adm_roles.is_superadmin is INTEGER
    theme_color: "",
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (field) => (next) => setValues((prev) => ({ ...prev, [field]: next }));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      // The built-in endpoint, reused as-is: post_store() runs validate()
      // against form_fields, drops undeclared keys via payload(), stamps
      // created_at/updated_at, and returns the new id. Only write a custom
      // post_ action when the insert itself has to differ.
      const res = await api.post("/roles/store", values);
      toast?.handleToast(res.data?.message || "Data saved.", res.data?.status || "success");
      // RolesController.post_store() overrides the base response to add a
      // `redirect`, sending a brand new role straight to its permission
      // matrix. Falling back to the list keeps this page working against
      // the un-overridden endpoint too.
      navigate(res.data?.redirect || "/roles");
    } catch (err) {
      // 422 sends detail as {field: message} -- straight into InputError
      // below. Anything else (403 from require("create"), 500) sends a
      // string, so it can only go to the toast.
      const detail = err.response?.data?.detail;
      if (detail && typeof detail === "object" && !Array.isArray(detail)) {
        setErrors(detail);
        toast?.handleToast("Please check the highlighted fields.", "danger");
      } else {
        toast?.handleToast(typeof detail === "string" ? detail : "Could not save.", "danger");
      }
      setBusy(false);
    }
  };

  return (
    <ContentPanel
      as="form"
      onSubmit={submit}
      title="Add Role"
      // No panel to close -- this is a page, so "back" means the list.
      onClose={() => navigate("/roles")}
      footer={
        <>
          <SecondaryButton type="button" onClick={() => navigate("/roles")}>
            Cancel
          </SecondaryButton>
          <PrimaryButton type="submit" disabled={busy}>
            {busy ? "Saving…" : "Create"}
          </PrimaryButton>
        </>
      }
    >
      <div className="form-grid">
        <label className="form-field">
          <InputLabel value="Role" required />
          <TextInput
            value={values.name}
            maxLength={255}
            onChange={(e) => set("name")(e.target.value)}
          />
          <InputError message={errors.name} />
        </label>

        <label className="form-field">
          <InputLabel value="Superadmin" />
          {/* Checkbox hands back 1/0 as its first argument, not an event */}
          <Checkbox checked={values.is_superadmin} onChange={set("is_superadmin")} />
          <InputError message={errors.is_superadmin} />
        </label>

        <label className="form-field">
          <InputLabel value="Theme" />
          {/* The payoff for owning the markup: a colour picker beside the
              text field, which "type": "text" in form_fields cannot express. */}
          <span className="swatch-cell">
            <input
              type="color"
              value={values.theme_color || "#3b82f6"}
              onChange={(e) => set("theme_color")(e.target.value)}
            />
            <TextInput
              value={values.theme_color}
              maxLength={255}
              placeholder="#3b82f6"
              onChange={(e) => set("theme_color")(e.target.value)}
            />
          </span>
          <InputError message={errors.theme_color} />
        </label>
      </div>
    </ContentPanel>
  );
}
