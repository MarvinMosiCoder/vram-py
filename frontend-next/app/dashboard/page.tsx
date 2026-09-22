"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/authContext";

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return <p className="p-8">Loading your account...</p>;
  }

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="mt-4">Signed in as {user.email}</p>
      <button
        type="button"
        onClick={handleLogout}
        className="mt-6 rounded border px-4 py-2"
      >
        Log out
      </button>
    </main>
  );
}
