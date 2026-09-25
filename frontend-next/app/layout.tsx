import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/context/toastContext";
import { AuthProvider } from "@/context/authContext";
import DocumentTitle from "@/components/system/DocumentTitle";

export const metadata: Metadata = {
  title: "Vram Admin",
  description: "Sign in to your Vram Admin workspace.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          <DocumentTitle />
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
