"use client";
import { useEffect, useState } from "react";
export default function SolverPage() {
  const [runs, setRuns] = useState<any[]>([]); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState("");
  const [model, setModel] = useState("adu"); const [timeout, setTimeoutSec] = useState(10); const [apply, setApply] = useState(true);
  async function load() { const r = await fetch("/api/solver").then(x => x.json()); if (r.ok) setRuns(r.runs); }
  useEffect(() => { load(); }, []);
  async function run() {
    setBusy(model); setMsg("⏳ Solver berjalan… (CP = backtracking pasti-valid bila selesai; GA = memetic; Tabu = tabu search)");
    const r = await fetch("/api/solver", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model, timeout, apply }) }).then(x => x.json());
    setBusy(""); setMsg(r.ok ? "✅ " + r.message + " Hasil: " + r.results.map((x: any) => `${x.model.toUpperCase()} hard=${x.hard} soft=${x.soft} (${x.seconds}s)`).join(" • ") : "⚠️ " + r.error);
    load();
  }
  return (
    <div className="card bg-base-100 shadow p-3 sm:p-4 lg:p-5">
      <h1 className="font-bold text-lg mb-1">🤖 Solver & Adu Model</h1>
      <p className="text-sm text-slate-500 mb-3">Skor bersama: <code>10000 × hard violation + soft penalty</code>. Hard wajib 0 — termasuk <b>pola blok 2JP</b> (Aturan, bila aktif): penugasan ditempatkan sebagai unit blok 2JP + sisa 1JP (3JP→2+1, 4JP→2+2). CP (constraint programming, backtracking + MRV + forward-checking) menjamin valid bila selesai — pengganti CP-SAT yang tidak tersedia sebagai modul Node. GA = memetic (GA + local search), Tabu = tabu search.</p>
      <div className="flex flex-wrap items-end gap-3 bg-slate-50 border rounded-lg p-3 mb-3">
        <label className="text-xs text-slate-500">Model<br/><select className="border rounded px-2 py-1.5 text-sm bg-white" value={model} onChange={e => setModel(e.target.value)}>
          <option value="adu">🏆 Adu ketiganya</option><option value="cp">CP (pasti valid)</option><option value="ga">GA Memetic</option><option value="tabu">Tabu Search</option></select></label>
        <label className="text-xs text-slate-500">Timeout/model (detik)<br/><input type="number" className="border rounded px-2 py-1.5 text-sm w-24" value={timeout} onChange={e => setTimeoutSec(+e.target.value)} /></label>
        <label className="text-sm flex items-center gap-1"><input type="checkbox" checked={apply} onChange={e => setApply(e.target.checked)} /> Terapkan hasil valid terbaik ke papan</label>
        <button disabled={!!busy} onClick={run} className="bg-indigo-600 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm">{busy ? "Berjalan…" : "▶️ Jalankan"}</button>
        <a className="text-sm underline ml-auto" href="/api/excel/jadwal">⬇️ Export Jadwal (Excel)</a>
      </div>
      {msg && <div className="mb-3 text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{msg}</div>}
      <h2 className="font-semibold mb-2">Riwayat Run</h2>
      <div className="overflow-x-auto"><table className="table table-sm w-full"><thead><tr className="text-left border-b"><th className="py-1">Waktu</th><th>Model</th><th>Hard</th><th>Soft</th><th>Detik</th><th>Catatan</th></tr></thead>
      <tbody>{runs.map(r => <tr key={r.id} className="border-b"><td className="py-1">{r.created_at}</td><td>{String(r.model).toUpperCase()}</td><td className={r.hard===0?"text-emerald-600 font-bold":"text-red-500"}>{r.hard}</td><td>{r.soft}</td><td>{Math.round(r.seconds*100)/100}</td><td>{r.note}</td></tr>)}</tbody></table></div>
    </div>
  );
}
