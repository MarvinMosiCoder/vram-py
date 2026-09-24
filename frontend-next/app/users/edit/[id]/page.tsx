import { notFound } from "next/navigation";
import UserForm from "@/components/users/UserForm";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id)) notFound();
  return <UserForm key={id} id={id} />;
}
