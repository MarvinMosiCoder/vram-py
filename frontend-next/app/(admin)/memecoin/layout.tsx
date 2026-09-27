import type { ReactNode } from "react";
import MemecoinNav from "@/components/memecoin/MemecoinNav";

// Shared by every /memecoin page, so the tabs stay mounted between them.
export default function MemecoinLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-7">
      <MemecoinNav />
      {children}
    </div>
  );
}
