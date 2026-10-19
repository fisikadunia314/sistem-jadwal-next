import "./globals.css";
import AppShell from "@/components/AppShell";
import { currentUser } from "@/lib/auth";
export const dynamic = "force-dynamic";
export const viewport = { width: "device-width", initialScale: 1 };
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const u = await currentUser();
  return (
    <html lang="id" data-theme="light"><body className="min-h-dvh bg-base-200 text-base-content antialiased">
      {u ? <AppShell user={{ display_name: String(u.display_name), role: String(u.role) }}>{children}</AppShell> : <main className="mx-auto w-full max-w-[1600px] p-2 sm:p-4 lg:p-6">{children}</main>}
    </body></html>
  );
}
