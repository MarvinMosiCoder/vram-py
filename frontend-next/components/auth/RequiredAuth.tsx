"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/authContext";

type RequireAuthProps = {
  children: ReactNode;
};

export default function RequireAuth({
  children,
}: RequireAuthProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <p role="status" className="p-8">
        Loading your account...
      </p>
    );
  }

  if (!user) {
    return (
      <p role="status" className="p-8">
        Redirecting to login...
      </p>
    );
  }

  return <>{children}</>;
}