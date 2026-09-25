import type { Metadata } from "next";
import Profile from "@/components/users/Profile";

export const metadata: Metadata = { title: "Profile" };

export default function Page() {
  return <Profile />;
}
