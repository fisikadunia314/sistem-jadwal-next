"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
export default function Login() {
  const [f, setF] = useState({ username: "", password: "" }); const [err, setErr] = useState(""); const r = useRouter();
  async function submit(e: React.FormEvent) { e.preventDefault(); setErr("");
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const d = await res.json().catch(() => ({ error: "Balasan server tidak valid" }));
    if (!res.ok) return setErr(d.error || "Gagal login");
    r.push("/jadwal"); r.refresh();
  }
  return (<div className="min-h-[80vh] flex items-center justify-center"><form onSubmit={submit} className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
    <div className="text-4xl mb-2">🗓️</div><h1 className="text-2xl font-bold">Sistem Jadwal Sekolah</h1>
    <p className="text-slate-500 text-sm mb-5">Versi Next.js + TypeScript. Login Superadmin / Pegawai.</p>
    {err && <div className="bg-red-100 text-red-800 rounded-lg px-3 py-2 text-sm mb-3">{err}</div>}
    <label className="text-sm font-medium block mb-1">Username</label>
    <input className="w-full border rounded-lg p-2 mb-3" value={f.username} onChange={e => setF({ ...f, username: e.target.value })} required autoFocus />
    <label className="text-sm font-medium block mb-1">Password</label>
    <input type="password" className="w-full border rounded-lg p-2 mb-4" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} required />
    <button className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-bold">Login</button>
    <p className="text-sm text-slate-500 mt-4 text-center">Pegawai belum punya akun? <Link className="text-indigo-600 font-semibold" href="/register">Daftar di sini</Link></p>
    <div className="mt-4 bg-slate-50 rounded-lg p-3 text-xs text-slate-500">Superadmin awal: <b>admin</b> / <b>admin123</b> • Contoh pegawai: <b>Budi Santoso</b> / <b>guru123</b> (Budi Santoso)</div>
  </form></div>);
}
