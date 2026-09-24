"use client";

import GeneratedModulePage from "@/components/modules/GeneratedModulePage";

export default function UsersPage() {
  return <GeneratedModulePage modulePath="users" renderFormField={(name, config, context) => {
    if (context.mode !== "view") return undefined;
    if (name === "password") return null;
    if (name === "id_adm_role") return <div><span className="text-skin-dim">{config.label}</span><p>{String(context.row?.role_name ?? "")}</p></div>;
    return undefined;
  }} />;
}
