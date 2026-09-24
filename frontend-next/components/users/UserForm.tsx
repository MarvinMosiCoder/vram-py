"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast as notify } from "react-toastify";
import api from "@/lib/http";
import { errorMessage, fieldErrors } from "@/lib/api-errors";
import { showToast } from "@/context/toastContext";
import { useAuth } from "@/context/authContext";
import TextInput from "@/components/form/TextInput";
import InputLabel from "@/components/form/InputLabel";
import InputError from "@/components/form/InputError";
import SelectInput from "@/components/form/SelectInput";
import PrimaryButton from "@/components/button/PrimaryButton";
import SecondaryButton from "@/components/button/SecondaryButton";
import type { ModuleData, SelectOption } from "@/types/modules";

const blank = { name: "", email: "", id_adm_role: "", password: "" };

export default function UserForm({ id }: { id?: string }) {
  const router = useRouter();
  const { user, logout, refreshUser } = useAuth();
  const [values, setValues] = useState(blank);
  const [roles, setRoles] = useState<SelectOption[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const submitting = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setLoading(true);
      setLoadError("");
      try {
        const { data } = await api.get<ModuleData>(id ? `/users/edit/${id}` : "/users/add", { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (id && !data.editRow) throw new Error("User not found.");
        const row = data.editRow;
        const options = data.formFields.id_adm_role?.options ?? [];
        // generated_module.find_row returns the configured list columns. Users
        // exposes role_name, so resolve its ID from the existing form options.
        // Ambiguous role names require an explicit selection instead of guessing.
        const matchingRoles = options.filter(option => option.label === row?.role_name);
        const roleId = row?.id_adm_role ?? (matchingRoles.length === 1 ? matchingRoles[0].value : "");
        setValues({ name: String(row?.name ?? ""), email: String(row?.email ?? ""), id_adm_role: String(roleId), password: "" });
        setRoles(options);
      } catch (error) {
        if (!controller.signal.aborted) setLoadError(errorMessage(error, "Could not load the form."));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [id, attempt]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || loading || loadError) return;
    const next: Record<string, string> = {};
    if (!values.name.trim()) next.name = "Name is required.";
    if (!values.email.trim()) next.email = "Email is required.";
    if (!values.id_adm_role) next.id_adm_role = "Role is required.";
    if (!id && !values.password.trim()) next.password = "Password is required.";
    setErrors(next);
    if (Object.keys(next).length) return;
    submitting.current = true;
    setBusy(true);
    setSaveError("");
    try {
      // Send only editable fields. A blank edit password preserves its hash.
      const payload = { name: values.name.trim(), email: values.email.trim(), id_adm_role: values.id_adm_role,
        ...(id ? { id } : {}), ...(values.password ? { password: values.password } : {}) };
      const { data } = await api.post(id ? "/users/update" : "/users/store", payload);
      if (id === String(user?.id)) {
        if (values.password || payload.email !== user?.email) {
          logout();
          showToast("User saved. Sign in again with your updated credentials.", "success");
          router.replace("/login");
          return;
        }
        try { await refreshUser(); }
        catch { showToast("User saved, but the account display could not refresh. Reload the page.", "warning"); }
      }
      // Preserve the success notification styling from the original React form.
      notify(data.message ?? "User saved.", {
        theme: "dark", icon: false, closeButton: false, autoClose: 3000,
        hideProgressBar: false,
        style: { background: "#1e293b", color: "#9ca3af", fontSize: "12px", minHeight: "32px", padding: "10px 15px", borderRadius: "6px" },
        progressClassName: "!bg-[linear-gradient(90deg,#38bdf8,#a855f7,#ef4444)] !h-[3px]",
      });
      router.push("/users");
    } catch (error) {
      setErrors(fieldErrors(error));
      setSaveError(errorMessage(error, "Could not save the user."));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (loading) return <p className="text-[13px] text-skin-dim">Loading…</p>;
  if (loadError) return <div role="alert"><p>{loadError}</p><SecondaryButton onClick={() => setAttempt(n => n + 1)}>Retry</SecondaryButton> <Link href="/users">Back to Users</Link></div>;

  return <form onSubmit={submit} className="shadow-sm rounded-md bg-skin-panel w-full justify-start flex flex-col mb-4">
    <div className="p-3 rounded-tl-md rounded-tr-md border-b border-skin-border">
      <h2 className="text-skin-text font-extrabold"><i className="fa fa-users" /> {id ? "Edit User" : "Add User"}</h2>
    </div>
    <fieldset disabled={busy} className="p-5 min-w-0">
      {saveError && <p role="alert" className="mb-3 text-red-500">{saveError}</p>}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-3.5">
        {(["name", "email"] as const).map(name => <div key={name} className="flex flex-col gap-1.5 text-[13px] text-skin-dim">
          <InputLabel htmlFor={`user-${name}`} value={name === "name" ? "Name" : "Email"} required />
          <TextInput id={`user-${name}`} type={name === "email" ? "email" : "text"} required maxLength={255} value={values[name]} onChange={e => setValues(v => ({ ...v, [name]: e.target.value }))} />
          <InputError message={errors[name]} />
        </div>)}
        <div className="flex flex-col gap-1.5 text-[13px] text-skin-dim">
          <InputLabel htmlFor="user-role" value="Role" required />
          <SelectInput type="react-select" inputId="user-role" disabled={busy} options={roles} value={roles.find(role => String(role.value) === values.id_adm_role) ?? null} placeholder="Choose a role" onChange={role => setValues(v => ({ ...v, id_adm_role: String(role?.value ?? "") }))} />
          <InputError message={errors.id_adm_role} />
        </div>
        <div className="flex flex-col gap-1.5 text-[13px] text-skin-dim">
          <InputLabel htmlFor="user-password" value={id ? "New password" : "Password"} required={!id} />
          <TextInput id="user-password" type="password" autoComplete="new-password" required={!id} maxLength={255} value={values.password} placeholder={id ? "Leave blank to keep the current password" : undefined} onChange={e => setValues(v => ({ ...v, password: e.target.value }))} />
          <InputError message={errors.password} />
        </div>
      </div>
    </fieldset>
    <div className="p-2 border-t-2 border-skin-border mt-3 flex justify-between">
      <SecondaryButton type="button" disabled={busy} onClick={() => router.push("/users")}><i className="fa fa-times-circle text-skin-dim" /> Cancel</SecondaryButton>
      <PrimaryButton disabled={busy}><i className="fa fa-save" /> {busy ? "Saving…" : "Save"}</PrimaryButton>
    </div>
  </form>;
}
