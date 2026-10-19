"use client";
import { useCallback, useEffect, useState } from "react";
export default function Pengajuan() {
  const [rows, setRows] = useState<any[]>([]); const [admin, setAdmin] = useState(false); const [msg, setMsg] = useState("");
  const load = useCallback(async () => { const r = await fetch("/api/requests"); const d = await r.json(); if (d.ok) { setRows(d.rows); setAdmin(d.is_admin); } }, []);
  useEffect(() => { load(); }, [load]);
  async function act(id: number, action: string) {
    const r = await fetch("/api/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) });
    const d = await r.json().catch(() => ({ error: "Balasan tidak valid" }));
    setMsg((r.ok ? "✅ " : "❌ ") + (d.message || d.error || ""));
    load();
  }
  return (<div>
    <h1 className="text-2xl font-bold mb-1">{admin ? "📥 Pengajuan Pindah Masuk" : "📨 Pengajuan Saya"}</h1>
    <p className="text-slate-500 text-sm mb-4">Persetujuan Superadmin menjalankan validasi ulang penuh sebelum menerapkan.</p>
    {msg && <div className="card bg-base-100 shadow px-3 py-2 text-sm mb-3">{msg}</div>}
    <div className="card bg-base-100 shadow overflow-x-auto"><table className="w-full text-sm">
      <thead><tr className="bg-slate-900 text-white text-left"><th className="p-2">Pengaju</th><th className="p-2">Usulan</th>{admin && <th className="p-2">🔮 Prediksi Saat Ini</th>}<th className="p-2">Status</th>{admin && <th className="p-2">Keputusan</th>}</tr></thead>
      <tbody>{rows.map(r => (<tr key={r.id} className="border-b align-top">
        <td className="p-2">{r.requester}</td><td className="p-2">{r.label}</td>
        {admin && <td className="p-2">{r.prediction ? <span className={`px-2 py-1 rounded-full text-xs font-bold ${r.prediction.state === "ok" ? "bg-emerald-100 text-emerald-800" : r.prediction.state === "invalid" ? "bg-red-100 text-red-800" : "bg-slate-200 text-slate-600"}`}>{r.prediction.label}</span> : <span className="text-slate-300">—</span>}</td>}
        <td className="p-2">{r.status === "pending" ? "⏳ Menunggu" : r.status === "approved" ? "✅ Disetujui" : r.status === "rejected" ? "❌ Ditolak" : r.status}</td>
        {admin && <td className="p-2 whitespace-nowrap">{r.status === "pending" && <>
          <button onClick={() => act(r.id, "approve")} className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold mr-1">Setujui & Terapkan</button>
          <button onClick={() => act(r.id, "reject")} className="bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold">Tolak</button></>}</td>}
      </tr>))}
      {!rows.length && <tr><td colSpan={5} className="p-4 text-slate-400">Belum ada pengajuan.</td></tr>}
      </tbody></table></div>
  </div>);
}
