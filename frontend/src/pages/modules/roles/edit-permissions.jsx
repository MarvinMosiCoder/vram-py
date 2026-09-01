import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../api";
import { useOptionalToast } from "../../../context/ToastContext";
import ContentPanel from "../../../components/panel/ContentPanel";
import PrimaryButton from "../../../components/button/PrimaryButton";
import Checkbox from "../../../components/form/Checkbox";

// GET /roles/edit-permissions/<id> -- RolesController.get_edit_permissions().
//
// Registered by its FILENAME, not by an import: modulePages.js globs
// pages/modules/**, so "roles/edit-permissions.jsx" claims the URL
// /roles/edit-permissions/... and the backend method name follows the same
// string. Nothing lists this file anywhere.
//
// `args` comes from ModuleRoute, which splits the route splat: the URL
// /roles/edit-permissions/7 arrives here as args = ["7"]. Do NOT reach for
// useParams().id -- the single "/:modulePath/*" route names no such param.
export default function RolesEditPermissions({ args = [] }) {
  const [id] = args;
  const navigate = useNavigate();
  const toast = useOptionalToast();
  const [data, setData] = useState(null);
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get(`/roles/edit-permissions/${id}`) // token attached by api.js interceptor
      .then((res) => {
        setData(res.data);
        setValues(/* seed from res.data */ {});
      })
      .catch(() => toast?.handleToast("Could not load permissions.", "danger"));
  }, [id]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post("/roles/save-permissions", { id, permissions: values });
      toast?.handleToast(res.data?.message, res.data?.status || "success");
      navigate("/roles");
    } catch (err) {
      // 422 sends detail as a {field: message} dict; anything else a string
      toast?.handleToast(err.response?.data?.detail || "Could not save.", "danger");
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <p className="muted">Loading…</p>;

  return (
    <ContentPanel
      as="form"
      onSubmit={submit}
      title={`Permissions · ${data.role?.name}`}
      onClose={() => navigate("/roles")}
      footer={
        <PrimaryButton type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </PrimaryButton>
      }
    >
      {/* Checkbox gives you 1/0 as arg 1 -- integer columns, not booleans */}
      <Checkbox
        checked={values.is_read}
        onChange={(next) => setValues({ ...values, is_read: next })}
      />
    </ContentPanel>
  );
}
