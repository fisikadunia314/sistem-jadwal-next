"use client";
import { useEffect, useRef, useState } from "react";
import TeacherColorPicker from "@/components/TeacherColorPicker";
const TABS = [
  { id: "teachers", label: "👩‍🏫 Guru", fields: [["code","Kode"],["name","Nama"],["max_jp_day","Maks JP/Hari (0=∞)"],["max_jp_week","Maks JP/Minggu (0=∞)"],["color_hex","Warna Guru HEX"]] },
  { id: "subjects", label: "📚 Mapel", fields: [["code","Kode"],["name","Nama"],["prefer_pagi","Prefer Pagi (0/1)"]] },
  { id: "classes", label: "🏫 Kelas", fields: [["name","Nama Kelas"]] },
  { id: "assignments", label: "🔗 Penugasan", fields: [["teacher_id","Guru"],["subject_id","Mapel"],["class_id","Kelas"],["jp_week","JP/Minggu"],["max_jp_day","Maks JP/Hari"]] },
] as const;
export default function MasterPage() {
  const [tab, setTab] = useState<string>("teachers");
  const [rows, setRows] = useState<any[]>([]); const [refs, setRefs] = useState<any>(null);
  const [form, setForm] = useState<any>({}); const [editId, setEditId] = useState<number | null>(null);
  const [colorSort, setColorSort] = useState<string>("default");
  const [msg, setMsg] = useState(""); const fileRef = useRef<HTMLInputElement>(null); const allFileRef = useRef<HTMLInputElement>(null);
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
  // konfirmasi hapus memakai modal sendiri (bukan confirm() bawaan yang bisa terblokir di sebagian browser/preview)
  const [pendingDelete, setPendingDelete] = useState<{ id: number; label: string; deps?: any } | null>(null);
  async function doDelete(force = false) {
    if (!pendingDelete) return;
    const r = await fetch(`/api/master/${tab}/${pendingDelete.id}${force ? "?force=1" : ""}`, { method: "DELETE" }).then(x => x.json());
    if (r.needsForce) { setPendingDelete({ ...pendingDelete, deps: r.dependencies }); setMsg("⚠️ " + r.error); return; }
    setMsg(r.ok ? "🗑️ " + (r.message || "Terhapus.") : "⚠️ " + (r.error || "Gagal menghapus"));
    if (r.ok) setPendingDelete(null);
    load();
  }
  async function importFile(f: File, all = false) {
    const fd = new FormData(); fd.append("file", f);
    const r = await fetch(all ? "/api/excel/import-all" : `/api/excel/${tab}`, { method: "POST", body: fd }).then(x => x.json());
    const errs = r.errors?.length ? "\nDilewati: " + r.errors.join(" | ") : "";
    setMsg((r.ok ? "✅ " : "⚠️ ") + (r.message || r.error || "Import gagal") + errs); load();
    if (fileRef.current) fileRef.current.value = "";
    if (allFileRef.current) allFileRef.current.value = "";
  }
  const refOptions = (key: string) => key === "teacher_id" ? refs?.teachers : key === "subject_id" ? refs?.subjects : key === "class_id" ? refs?.classes : null;
  const hueOf = (hex: string) => { const v = /^#[0-9a-fA-F]{6}$/.test(hex || "") ? hex : "#808080"; const n = parseInt(v.slice(1), 16); const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return { hue: 999, sat: 0 }; let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; return { hue: h, sat: d / (mx || 1) }; };
  const displayRows = tab === "teachers" && colorSort === "hue"
    ? [...rows].sort((a, b) => { const x = hueOf(a.color_hex || ""), y = hueOf(b.color_hex || ""); const kx = x.sat < 0.08 ? 999 : (x.hue >= 340 ? x.hue - 360 : x.hue), ky = y.sat < 0.08 ? 999 : (y.hue >= 340 ? y.hue - 360 : y.hue); return kx - ky || String(a.code || "").localeCompare(String(b.code || "")); })
    : rows;
  return (
    <div className="card bg-base-100 shadow p-3 sm:p-4 lg:p-5">
      <h1 className="font-bold text-lg mb-1">🗂️ Data Master (CRUD + Excel)</h1>
      <p className="text-sm text-slate-500 mb-3">Khusus Superadmin. Setelah mengubah penugasan/jumlah JP, jalankan Solver untuk men-generate ulang jadwal.</p>
      <div className="mb-4 rounded-box border border-violet-200 bg-violet-50 p-3">
        <div className="font-bold text-violet-900">📥 Import Satu File (semua bagian, beda sheet)</div>
        <p className="mt-1 text-sm text-violet-800">Format resmi: satu file Excel berisi sheet <b>Petunjuk, Guru, Mapel, Kelas, Penugasan, Ketidaktersediaan</b>. Isi mulai baris ke-2 dan jangan mengubah nama sheet/judul kolom. Penugasan ditulis memakai <b>KodeGuru + KodeMapel + NamaKelas</b>, bukan ID. Data berkode sama akan diperbarui, bukan diduplikat; sesudah import ada laporan jumlah baru/diperbarui/dilewati dan alasannya.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <a className="btn btn-primary btn-sm" href="/api/excel/template">⬇️ Download Template Import (.xlsx)</a>
          <button className="btn btn-secondary btn-sm" onClick={() => allFileRef.current?.click()}>⬆️ Import Semua Sheet</button>
          <input ref={allFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => e.target.files?.[0] && importFile(e.target.files[0], true)} />
          <a className="btn btn-outline btn-sm" href="/api/excel/jadwal">⬇️ Export Jadwal (Format Cetak per Tingkat)</a>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mb-3">{TABS.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-1.5 rounded-lg text-sm ${tab===t.id?"bg-indigo-600 text-white":"bg-slate-100"}`}>{t.label}</button>)}</div>
      {msg && <div className="mb-3 text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{msg}</div>}
      <div className="flex flex-wrap items-end gap-2 mb-4 bg-slate-50 border rounded-lg p-3">
        {cfg.fields.map(([key, label]) => { const opts = refOptions(key); return (
          <label key={key} className="text-xs text-slate-500">{label}<br/>{key === "color_hex" ?
            <TeacherColorPicker value={form.color_hex || ""} excludeId={editId} label={form.code || "Guru baru"} onChange={color => setForm((f: any) => ({ ...f, color_hex: color }))} /> : opts ?
            <select className="border rounded px-2 py-1.5 text-sm bg-white" value={form[key] ?? ""} onChange={e => setForm({ ...form, [key]: e.target.value })}><option value="">— pilih —</option>{opts.map((o: any) => <option key={o.id} value={o.id}>{o.code ? o.code+" — " : ""}{o.name}</option>)}</select> :
            <input className="border rounded px-2 py-1.5 text-sm" value={form[key] ?? ""} onChange={e => setForm({ ...form, [key]: e.target.value })} />}</label> ); })}
        <button onClick={save} className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-sm">{editId ? "💾 Simpan Perubahan" : "➕ Tambah"}</button>
        {editId && <button onClick={() => { setEditId(null); setForm({}); }} className="px-3 py-1.5 rounded-lg text-sm bg-slate-200">Batal</button>}
        <span className="ml-auto flex gap-2">
          <a className="bg-sky-600 text-white px-3 py-1.5 rounded-lg text-sm" href={`/api/excel/${tab}`}>⬇️ Export Excel</a>
          <a className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm" href={`/api/excel/template-${tab}`}>📄 Template {cfg.label}</a>
          <button onClick={() => fileRef.current?.click()} className="bg-violet-600 text-white px-3 py-1.5 rounded-lg text-sm">⬆️ Import Sheet Ini</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => e.target.files?.[0] && importFile(e.target.files[0])} />
        </span>
      </div>
      {tab === "teachers" && <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">🌈 Urutan warna:
        <select className="border rounded px-2 py-1.5 text-sm bg-white" value={colorSort} onChange={e => setColorSort(e.target.value)}>
          <option value="default">Bawaan (ID)</option>
          <option value="hue">Spektrum: merah → jingga → kuning → hijau → biru → ungu</option>
        </select>
        <span>Kolom <b>Warna Guru HEX</b> menampilkan contoh warna tiap guru; urutan spektrum memakai hue 0° (merah) sampai 300° (ungu).</span>
      </div>}
      <div className="overflow-auto max-h-[55vh]"><table className="w-full text-sm">
        <thead><tr className="text-left border-b"><th className="py-1 pr-2">ID</th>{cfg.fields.map(([k,l]) => <th key={k} className="pr-2">{l}</th>)}<th>Aksi</th></tr></thead>
        <tbody>{displayRows.map(r => <tr key={r.id} className="border-b hover:bg-slate-50"><td className="py-1 pr-2">{r.id}</td>
          {cfg.fields.map(([k]) => <td key={k} className="pr-2">{k==="color_hex" ? <span className="inline-flex items-center gap-1.5"><span className="inline-block h-6 w-10 rounded border border-black/25" style={{ background: r.color_hex || "#CBD5E1" }} /><span><code>{r.color_hex || "otomatis"}</code>{r.color_hex ? <span className="block text-[10px] text-slate-400">hue {Math.round(hueOf(r.color_hex).hue)}°</span> : null}</span></span> : k==="teacher_id" ? `${r.tcode||""} ${r.tname||""}` : k==="subject_id" ? r.scode : k==="class_id" ? r.cname : String(r[k] ?? "")}</td>)}
          <td className="whitespace-nowrap"><button className="text-indigo-600 mr-2" onClick={() => { setEditId(r.id); setForm(Object.fromEntries(cfg.fields.map(([k]) => [k, r[k] ?? ""]))); }}>✏️</button>
          <button className="btn btn-error btn-xs" onClick={() => setPendingDelete({ id: r.id, label: cfg.fields.map(([k]) => String(r[k] ?? "")).filter(Boolean).join(" • ") || `#${r.id}` })}>🗑️ Hapus</button></td></tr>)}</tbody></table></div>
      <p className="text-xs text-slate-400 mt-2">{displayRows.length} baris • Export jadwal lengkap: <a className="underline" href="/api/excel/jadwal">/api/excel/jadwal</a></p>
      {pendingDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl">🗑️</div>
            <h3 className="text-lg font-bold">Hapus data ini?</h3>
            <p className="mt-1 break-words text-sm text-slate-600">{pendingDelete.label}</p>
            {pendingDelete.deps ? (
              <div className="mt-3 rounded-box bg-red-50 p-3 text-left text-sm text-red-800">
                <b>Data ini masih dipakai:</b>
                <ul className="mt-1 list-disc pl-5">
                  <li>{pendingDelete.deps.assignments} penugasan</li>
                  <li>{pendingDelete.deps.entries} kartu jadwal</li>
                  {pendingDelete.deps.unavailability > 0 && <li>{pendingDelete.deps.unavailability} ketidaktersediaan</li>}
                  {pendingDelete.deps.linkedUsers > 0 && <li>{pendingDelete.deps.linkedUsers} akun pengguna terhubung (kaitannya dilepas, akunnya tidak dihapus)</li>}
                </ul>
                <p className="mt-1">Bila dilanjutkan, semua relasi di atas ikut terhapus. Sesudahnya jalankan Solver untuk meng-generate ulang jadwal.</p>
              </div>
            ) : <p className="mt-2 text-sm text-slate-500">Tindakan ini tidak dapat dibatalkan.</p>}
            <div className="mt-4 flex justify-center gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => setPendingDelete(null)}>Batal</button>
              <button className="btn btn-error btn-sm" onClick={() => doDelete(!!pendingDelete.deps)}>{pendingDelete.deps ? "Ya, Hapus Beserta Relasinya" : "Ya, Hapus"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
