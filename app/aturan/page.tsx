"use client";
import { useEffect, useState } from "react";
const ALLDAYS = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
export default function AturanPage() {
  const [st, setSt] = useState<any>(null); const [msg, setMsg] = useState("");
  useEffect(() => { fetch("/api/settings").then(x => x.json()).then(r => r.ok && setSt(r.settings)); }, []);
  if (!st) return <p className="text-sm">Memuat Aturan…</p>;
  const days: string[] = (st.active_days || "").split(",").filter(Boolean);
  const times = (k: string) => { try { return JSON.parse(st[k]); } catch { return {}; } };
  function setTime(k: string, p: number, v: string) { const t = times(k); t[p] = v; setSt({ ...st, [k]: JSON.stringify(t) }); }
  async function save() { const r = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(st) }).then(x => x.json()); setMsg(r.ok ? "✅ Aturan tersimpan. Papan & solver memakai Aturan baru." : "⚠️ " + r.error); }
  const TimeGrid = ({ k, title }: { k: string; title: string }) => (
    <div><h3 className="font-semibold text-sm mb-1">{title}</h3><div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {[1,2,3,4,5,6,7,8].map(p => <label key={p} className="text-xs text-slate-500">JP{p}<input className="border rounded px-2 py-1 w-full text-sm" value={times(k)[p] || ""} onChange={e => setTime(k, p, e.target.value)} placeholder={k==="times_friday" && (p===5||p===6) ? "Ibadah & Istirahat" : "07:30-08:10"} /></label>)}
    </div></div>);
  return (
    <div className="card bg-base-100 shadow p-3 sm:p-4 lg:p-5 space-y-4">
      <div><h1 className="font-bold text-lg">⚙️ Aturan Penjadwalan</h1><p className="text-sm text-slate-500">Khusus Superadmin. Dipakai papan, validasi drag & drop, dan ketiga solver secara bersama.</p></div>
      {msg && <div className="text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{msg}</div>}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input type="checkbox" className="mt-0.5" checked={st.pola_blok !== "0"} onChange={e => setSt({ ...st, pola_blok: e.target.checked ? "1" : "0" })} />
          <span><b>🧱 Pola Blok 2JP saat generate (aktif)</b><br/>
          <span className="text-slate-600">Jumlah JP/minggu tiap penugasan dipecah menjadi blok 2 JP berurutan dalam satu blok (JP1–2, JP3–4, JP5–6, JP7–8; Jumat JP1–2, JP3–4, JP7–8) plus sisa 1 JP bila ganjil. Contoh: <b>3 JP → 2+1</b>, <b>4 JP → 2+2</b>, <b>5 JP → 2+2+1</b>. Ketiga solver (CP/GA/Tabu) wajib mengikutinya; papan menampilkannya sebagai kartu gabungan <b>2JP</b> dan kartu sisa <b>1JP</b>. Matikan bila ingin solver bebas menempatkan per-JP.</span></span>
        </label>
      </div>
      <div><h3 className="font-semibold text-sm mb-1">Hari Aktif</h3><div className="flex gap-3 flex-wrap">{ALLDAYS.map(d => <label key={d} className="text-sm flex gap-1 items-center"><input type="checkbox" checked={days.includes(d)} onChange={e => setSt({ ...st, active_days: (e.target.checked ? [...days, d] : days.filter(x => x !== d)).join(",") })} />{d}</label>)}</div></div>
      <div className="grid md:grid-cols-4 gap-3">
        <label className="text-xs text-slate-500">Timeout solver (detik)<input type="number" className="border rounded px-2 py-1.5 w-full text-sm" value={st.solver_timeout} onChange={e => setSt({ ...st, solver_timeout: e.target.value })} /></label>
        <label className="text-xs text-slate-500">Bobot celah guru (w_gap)<input type="number" className="border rounded px-2 py-1.5 w-full text-sm" value={st.w_gap} onChange={e => setSt({ ...st, w_gap: e.target.value })} /></label>
        <label className="text-xs text-slate-500">Bobot JP siang mapel pagi (w_sore)<input type="number" className="border rounded px-2 py-1.5 w-full text-sm" value={st.w_sore} onChange={e => setSt({ ...st, w_sore: e.target.value })} /></label>
        <label className="text-xs text-slate-500">Bobot sebaran mapel (w_sebar)<input type="number" className="border rounded px-2 py-1.5 w-full text-sm" value={st.w_sebar} onChange={e => setSt({ ...st, w_sebar: e.target.value })} /></label>
      </div>
      <TimeGrid k="times_general" title="🕗 Jam JP Senin–Kamis/Sabtu" />
      <TimeGrid k="times_friday" title="🕌 Jam JP Jumat (JP5–JP6 ibadah & istirahat — kosongkan/tidak dipakai)" />
      <p className="text-xs text-slate-400">Jumat tetap memakai JP mengajar 1–4 & 7–8 pada papan dan solver.</p>
      <button onClick={save} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm">💾 Simpan Aturan</button>
    </div>
  );
}
