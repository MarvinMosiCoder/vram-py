import { useEffect, useState } from "react";
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

export default function RolesAdd() {
  const navigate = useNavigate();
  const toast = useOptionalToast();
  const [values, setValues] = useState({
    name: "",
    is_superadmin: 0,   // 1/0, not true/false -- adm_roles.is_superadmin is INTEGER
    theme_color: "",
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const [module, setModule] = useState(null);

  const set = (field) => (next) => setValues((prev) => ({ ...prev, [field]: next }));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const res = await api.post("/roles/store", values);
      toast?.handleToast(res.data?.message || "Data saved.", res.data?.status || "success");
      navigate(res.data?.redirect || "/roles");
    } catch (err) {
  
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

  useEffect(() => {
    const fetchModule = async () => {
      try {
        const res = await api.get("/roles/module");
        setModule(res.data);
      } catch (err) {
        toast?.handleToast("Could not fetch module data.", "danger");
      }
    };
    fetchModule();
  }, [toast]);
  console.log("Module data:", module);
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
