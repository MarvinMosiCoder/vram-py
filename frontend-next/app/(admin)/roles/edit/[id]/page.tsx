import { notFound } from "next/navigation";
import RoleForm from "@/components/roles/RolesForm";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id)) notFound();
  return <RoleForm key={id} id={id} />;
}
