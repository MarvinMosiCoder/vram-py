import type { Metadata } from "next";
import ChangePassword from "@/components/users/ChangePassword";

export const metadata: Metadata = { title: "Change Password" };

export default function Page() {
  return <ChangePassword />;
}
