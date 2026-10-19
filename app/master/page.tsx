"use client";
import { useEffect, useRef, useState } from "react";
const TABS = [
  { id: "teachers", label: "👩‍🏫 Guru", fields: [["code","Kode"],["name","Nama"],["max_jp_day","Maks JP/Hari (0=∞)"],["max_jp_week","Maks JP/Minggu (0=∞)"]] },
  { id: "subjects", label: "📚 Mapel", fields: [["code","Kode"],["name","Nama"],["prefer_pagi","Prefer Pagi (0/1)"]] },
  { id: "classes", label: "🏫 Kelas", fields: [["name","Nama Kelas"]] },
  { id: "assignments", label: "🔗 Penugasan", fields: [["teacher_id","Guru"],["subject_id","Mapel"],["class_id","Kelas"],["jp_week","JP/Minggu"],["max_jp_day","Maks JP/Hari"]] },
] as const;
export default function MasterPage() {
  const [tab, setTab] = useState<string>("teachers");
  const [rows, setRows] = useState<any[]>([]); const [refs, setRefs] = useState<any>(null);
  const [form, setForm] = useState<any>({}); const [editId, setEditId] = useState<number | null>(null);
  const [msg, setMsg] = useState(""); const fileRef = useRef<HTMLInputElement>(null);
  const cfg = TABS.find(t => t.id === tab)!;
  async function load(t = tab) {
    const r = await fetch(`/api/master/${t}`).then(x => x.json());
    if (r.ok) { setRows(r.rows); setRefs(r.refs || null); } else setMsg("⚠️ " + r.error);
  }
  useEffect(() => { setForm({}); setEditId(null); load(tab); }, [tab]);
  async function save() {
    const url = editId ? `/api/master/${tab}/${editId}` : `/api/master/${tab}`;
    const r = await fetch(url, { method: editId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }).then(x => x.json());
    setMsg(r.ok ? "✅ Tersimpan." : "⚠️ " + (r.error || "Gagal")); if (r.ok) { setForm({}); setEditId(null); load(); }
  }
  async function del(id: number) {
    if (!confirm("Hapus baris ini?")) return;
    const r = await fetch(`/api/master/${tab}/${id}`, { method: "DELETE" }).then(x => x.json());
    setMsg(r.ok ? "🗑️ Terhapus." : "⚠️ " + (r.error || "Gagal")); load();
  }
  async function importFile(f: File) {
    const fd = new FormData(); fd.append("file", f);
    const r = await fetch(`/api/excel/${tab}`, { method: "POST", body: fd }).then(x => x.json());
    setMsg(r.ok ? "✅ " + r.message : "⚠️ " + r.error); load();
  }
  const refOptions = (key: string) => key === "teacher_id" ? refs?.teachers : key === "subject_id" ? refs?.subjects : key === "class_id" ? refs?.classes : null;
  return (
    <div className="card bg-base-100 shadow p-3 sm:p-4 lg:p-5">
      <h1 className="font-bold text-lg mb-1">🗂️ Data Master (CRUD + Excel)</h1>
      <p className="text-sm text-slate-500 mb-3">Khusus Superadmin. Setelah mengubah penugasan/jumlah JP, jalankan Solver untuk men-generate ulang jadwal.</p>
      <div className="flex flex-wrap gap-2 mb-3">{TABS.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-1.5 rounded-lg text-sm ${tab===t.id?"bg-indigo-600 text-white":"bg-slate-100"}`}>{t.label}</button>)}</div>
      {msg && <div className="mb-3 text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{msg}</div>}
      <div className="flex flex-wrap items-end gap-2 mb-4 bg-slate-50 border rounded-lg p-3">
        {cfg.fields.map(([key, label]) => { const opts = refOptions(key); return (
          <label key={key} className="text-xs text-slate-500">{label}<br/>{opts ?
            <select className="border rounded px-2 py-1.5 text-sm bg-white" value={form[key] ?? ""} onChange={e => setForm({ ...form, [key]: e.target.value })}><option value="">— pilih —</option>{opts.map((o: any) => <option key={o.id} value={o.id}>{o.code ? o.code+" — " : ""}{o.name}</option>)}</select> :
            <input className="border rounded px-2 py-1.5 text-sm" value={form[key] ?? ""} onChange={e => setForm({ ...form, [key]: e.target.value })} />}</label> ); })}
        <button onClick={save} className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-sm">{editId ? "💾 Simpan Perubahan" : "➕ Tambah"}</button>
        {editId && <button onClick={() => { setEditId(null); setForm({}); }} className="px-3 py-1.5 rounded-lg text-sm bg-slate-200">Batal</button>}
        <span className="ml-auto flex gap-2">
          <a className="bg-sky-600 text-white px-3 py-1.5 rounded-lg text-sm" href={`/api/excel/${tab}`}>⬇️ Export Excel</a>
          <button onClick={() => fileRef.current?.click()} className="bg-violet-600 text-white px-3 py-1.5 rounded-lg text-sm">⬆️ Import Excel</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => e.target.files?.[0] && importFile(e.target.files[0])} />
        </span>
      </div>
      <div className="overflow-auto max-h-[55vh]"><table className="w-full text-sm">
        <thead><tr className="text-left border-b"><th className="py-1 pr-2">ID</th>{cfg.fields.map(([k,l]) => <th key={k} className="pr-2">{l}</th>)}<th>Aksi</th></tr></thead>
        <tbody>{rows.map(r => <tr key={r.id} className="border-b hover:bg-slate-50"><td className="py-1 pr-2">{r.id}</td>
          {cfg.fields.map(([k]) => <td key={k} className="pr-2">{k==="teacher_id" ? `${r.tcode||""} ${r.tname||""}` : k==="subject_id" ? r.scode : k==="class_id" ? r.cname : String(r[k] ?? "")}</td>)}
          <td className="whitespace-nowrap"><button className="text-indigo-600 mr-2" onClick={() => { setEditId(r.id); setForm(Object.fromEntries(cfg.fields.map(([k]) => [k, r[k] ?? ""]))); }}>✏️</button>
          <button className="text-red-500" onClick={() => del(r.id)}>🗑️</button></td></tr>)}</tbody></table></div>
      <p className="text-xs text-slate-400 mt-2">{rows.length} baris • Export jadwal lengkap: <a className="underline" href="/api/excel/jadwal">/api/excel/jadwal</a></p>
    </div>
  );
}
