"use client";
import { useEffect, useState } from "react";
const DAYS = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
const plist = (d: string) => d === "Jumat" ? [1,2,3,4,7,8] : [1,2,3,4,5,6,7,8];
export default function KetersediaanPage() {
  const [data, setData] = useState<any>(null); const [etype, setEtype] = useState("teacher"); const [eid, setEid] = useState<number>(0); const [msg, setMsg] = useState("");
  async function load() { const r = await fetch("/api/unavailability").then(x => x.json()); if (r.ok) { setData(r); if (!eid) setEid(r.is_admin ? (r.teachers[0]?.id || 0) : (r.me_teacher || 0)); } }
  useEffect(() => { load(); }, []);
  if (!data) return <p className="text-sm">Memuat ketersediaan…</p>;
  const off = new Set((data.rows as any[]).filter(r => r.entity_type === etype && r.entity_id === eid).map(r => `${r.day}|${r.period}`));
  async function toggle(day: string, period: number) {
    const r = await fetch("/api/unavailability", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entity_type: etype, entity_id: eid, day, period }) }).then(x => x.json());
    setMsg(r.ok ? (r.off ? `🚫 ${day} JP${period} ditandai tidak tersedia.` : `✅ ${day} JP${period} tersedia lagi.`) : "⚠️ " + r.error); load();
  }
  const opts = etype === "teacher" ? data.teachers : data.classes;
  return (
    <div className="card bg-base-100 shadow p-3 sm:p-4 lg:p-5">
      <h1 className="font-bold text-lg mb-1">🚫 Ketidaktersediaan</h1>
      <p className="text-sm text-slate-500 mb-3">{data.is_admin ? "Superadmin dapat mengatur guru & kelas." : "Anda hanya dapat mengatur ketidaktersediaan Anda sendiri."} Klik sel untuk menandai/membatalkan. Merah = tidak tersedia (hard constraint solver & drag & drop).</p>
      {msg && <div className="mb-3 text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{msg}</div>}
      <div className="flex gap-2 mb-3 items-end flex-wrap">
        {data.is_admin && <><label className="text-xs text-slate-500">Jenis<br/><select className="border rounded px-2 py-1.5 text-sm bg-white" value={etype} onChange={e => { setEtype(e.target.value); setEid(0); }}><option value="teacher">Guru</option><option value="class">Kelas</option></select></label>
        <label className="text-xs text-slate-500">Nama<br/><select className="border rounded px-2 py-1.5 text-sm bg-white" value={eid} onChange={e => setEid(+e.target.value)}>{opts.map((o: any) => <option key={o.id} value={o.id}>{o.code ? o.code+" — " : ""}{o.name}</option>)}</select></label></>}
        {!data.is_admin && <span className="text-sm">Guru: <b>{data.teachers.find((t: any) => t.id === data.me_teacher)?.name || "(akun belum dikaitkan — hubungi Superadmin)"}</b></span>}
      </div>
      <div className="overflow-auto rounded-box border"><table className="table table-sm border-collapse min-w-[560px]"><thead><tr><th className="border px-2 py-1 bg-slate-50">Hari</th>{[1,2,3,4,5,6,7,8].map(p => <th key={p} className="border px-2 py-1 bg-slate-50">JP{p}</th>)}</tr></thead>
      <tbody>{DAYS.map(d => <tr key={d}><td className="border px-2 py-1 font-medium bg-slate-50">{d}</td>{[1,2,3,4,5,6,7,8].map(p =>
        d === "Jumat" && (p === 5 || p === 6) ? <td key={p} className="border px-2 py-1 bg-amber-100 text-center text-xs">🕌 Ibadah</td> :
        <td key={p} onClick={() => plist(d).includes(p) && toggle(d, p)} className={`border px-2 py-1 text-center cursor-pointer ${off.has(`${d}|${p}`) ? "bg-red-200" : "bg-emerald-50 hover:bg-emerald-100"}`}>{off.has(`${d}|${p}`) ? "🚫" : "✓"}</td>)}</tr>)}</tbody></table></div>
    </div>
  );
}
