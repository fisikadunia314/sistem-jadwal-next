"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type ShellUser = { display_name: string; role: string };

const TITLES: Record<string, string> = {
  "/jadwal": "🧩 Papan Jadwal",
  "/pengajuan": "📥 Pengajuan",
  "/ketersediaan": "🚫 Ketersediaan",
  "/master": "🗂️ Data Master",
  "/solver": "🤖 Solver & Adu Model",
  "/aturan": "⚙️ Aturan Penjadwalan",
  "/knowledge": "📚 Knowledge Base Algoritma",
  "/profil": "👤 Profil & Akun",
};

export default function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mini, setMini] = useState(false); // sidebar mini (ikon saja) khusus layar laptop/desktop
  const isAdmin = user.role === "admin";

  // tutup drawer otomatis setiap pindah halaman (penting di HP/tablet)
  useEffect(() => { setOpen(false); }, [pathname]);

  const items = [
    { href: "/jadwal", icon: "🧩", label: "Papan Jadwal", show: true },
    { href: "/pengajuan", icon: "📥", label: isAdmin ? "Pengajuan Masuk" : "Pengajuan Saya", show: true },
    { href: "/ketersediaan", icon: "🚫", label: "Ketersediaan", show: true },
    { href: "/knowledge", icon: "📚", label: "Knowledge Base", show: true },
    { href: "/profil", icon: "👤", label: "Profil Saya", show: true },
    { href: "/master", icon: "🗂️", label: "Data Master", show: isAdmin },
    { href: "/solver", icon: "🤖", label: "Solver & Adu Model", show: isAdmin },
    { href: "/aturan", icon: "⚙️", label: "Aturan", show: isAdmin },
  ].filter(i => i.show);

  return (
    <div className="drawer lg:drawer-open">
      <input id="app-drawer" type="checkbox" className="drawer-toggle" checked={open} onChange={e => setOpen(e.target.checked)} />

      {/* ---------- konten: topbar + halaman ---------- */}
      <div className="drawer-content flex min-h-dvh flex-col bg-base-200">
        <header className="navbar sticky top-0 z-40 min-h-14 bg-base-100/95 px-2 shadow-sm backdrop-blur sm:px-4">
          <div className="flex-none lg:hidden">
            <label htmlFor="app-drawer" aria-label="Buka menu" className="btn btn-square btn-ghost btn-sm sm:btn-md">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="h-6 w-6 stroke-current"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </label>
          </div>
          <div className="flex-none hidden lg:block">
            <button type="button" onClick={() => setMini(m => !m)} aria-label={mini ? "Lebarkan sidebar" : "Mini-kan sidebar"} title={mini ? "Lebarkan sidebar" : "Mini-kan sidebar"} className="btn btn-square btn-ghost btn-sm">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="h-5 w-5 stroke-current"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={mini ? "M13 5l7 7-7 7M5 5l7 7-7 7" : "M11 19l-7-7 7-7M20 19l-7-7 7-7"} /></svg>
            </button>
          </div>
          <div className="min-w-0 flex-1 px-1 sm:px-2">
            <div className="truncate text-base font-bold sm:text-lg">{TITLES[pathname] || "🗓️ Sistem Jadwal"}</div>
            <div className="hidden text-xs text-base-content/60 sm:block">Sistem penjadwalan sekolah otomatis</div>
          </div>
          <div className="flex-none items-center gap-2">
            <span className={`badge badge-sm sm:badge-md ${isAdmin ? "badge-primary" : "badge-secondary"}`}>{isAdmin ? "Superadmin" : "Pegawai"}</span>
            <div className="hidden max-w-40 items-center gap-2 md:flex">
              <div className="avatar placeholder"><div className="w-8 rounded-full bg-neutral text-neutral-content"><span className="text-xs">{user.display_name.slice(0, 1).toUpperCase()}</span></div></div>
              <Link href="/profil" className="truncate text-sm font-medium hover:underline">{user.display_name}</Link>
            </div>
            <form action="/logout" method="post"><button className="btn btn-error btn-xs sm:btn-sm">Logout</button></form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] flex-1 p-2 sm:p-4 lg:p-6">{children}</main>
        <footer className="px-4 pb-3 text-center text-[11px] text-base-content/50">Sistem Jadwal Sekolah • Next.js + Tailwind + DaisyUI</footer>
      </div>

      {/* ---------- sidebar ---------- */}
      <div className="drawer-side z-50">
        <label htmlFor="app-drawer" aria-label="Tutup menu" className="drawer-overlay" />
        <aside className={`flex min-h-full w-72 max-w-[85vw] flex-col bg-base-100 shadow-xl transition-all duration-200 ${mini ? "lg:w-[76px]" : "lg:w-72"}`}>
          <div className="flex items-center gap-3 border-b border-base-200 px-5 py-4">
            <span className="text-2xl">🗓️</span>
            <div className={`min-w-0 ${mini ? "lg:hidden" : ""}`}>
              <div className="truncate font-bold leading-tight">Sistem Jadwal</div>
              <div className="text-xs text-base-content/60">Panel {isAdmin ? "Superadmin" : "Pegawai"}</div>
            </div>
            <button type="button" aria-label="Tutup menu" onClick={() => setOpen(false)} className="btn btn-ghost btn-square btn-sm ml-auto lg:hidden">✕</button>
          </div>

          <ul className="menu w-full flex-1 gap-1 overflow-y-auto p-3 text-base-content">
            <li className={`menu-title ${mini ? "lg:hidden" : ""}`}>Menu</li>
            {items.map(i => (
              <li key={i.href}>
                <Link href={i.href} onClick={() => setOpen(false)} title={i.label} data-tip={i.label}
                  className={`${pathname === i.href ? "active font-semibold" : ""} ${mini ? "lg:justify-center lg:px-0 lg:tooltip lg:tooltip-right" : ""}`}>
                  <span className="text-lg leading-none">{i.icon}</span> <span className={mini ? "lg:hidden" : ""}>{i.label}</span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="border-t border-base-200 p-4">
            <div className={`mb-2 flex items-center gap-2 ${mini ? "lg:justify-center" : ""}`}>
              <div className="avatar placeholder"><div className="w-9 rounded-full bg-neutral text-neutral-content"><span className="text-sm">{user.display_name.slice(0, 1).toUpperCase()}</span></div></div>
              <div className={`min-w-0 ${mini ? "lg:hidden" : ""}`}>
                <Link href="/profil" className="block truncate text-sm font-semibold hover:underline">{user.display_name}</Link>
                <div className="text-xs text-base-content/60">{isAdmin ? "Superadmin" : "Pegawai"}</div>
              </div>
            </div>
            <form action="/logout" method="post"><button className="btn btn-error btn-sm btn-block" title="Logout">{mini ? "⎋" : "Logout"}</button></form>
          </div>
        </aside>
      </div>
    </div>
  );
}
