import type { Metadata } from "next";
import Chat from "@/components/chat/Chat";

export const metadata: Metadata = { title: "Chat" };

// Next.js splits each route into its own chunk, so react-markdown and its
// markdown toolchain download only when /chat is opened -- the job React.lazy
// did in the legacy App.jsx. Keep them out of shared components to keep it so.
export default function Page() {
  return <Chat />;
}
