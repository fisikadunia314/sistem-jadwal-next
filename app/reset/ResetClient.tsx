"use client";
import { useCallback, useEffect, useState } from "react";

type Scope = { id: string; label: string; kata: string; ringkas: string };
type Counts = Record<string, number>;

const IKON: Record<string, string> = {
  jadwal: "🧹",
  penugasan: "🧾",
  master: "🗑️",
  total: "💥",
  seed: "♻️",
};

const NAMA: Record<string, string> = {
  teachers: "Guru",
  subjects: "Mapel",
  classes: "Kelas",
  assignments: "Penugasan",
  unavailability: "Ketersediaan",
  entries: "Kartu Jadwal",
  users: "Akun",
  pending: "Pengajuan pending",
  runs: "Riwayat solver",
};

export default function ResetClient() {
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [counts, setCounts] = useState<Counts>({});
  const [pilih, setPilih] = useState<Scope | null>(null);
  const [kata, setKata] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean | null; id: number }>({ msg: "", ok: null, id: 0 });

  const tampilkan = useCallback((msg: string, ok: boolean | null) => setToast(t => ({ msg, ok, id: t.id + 1 })), []);
  useEffect(() => { if (!toast.id) return; const tm = setTimeout(() => setToast({ msg: "", ok: null, id: 0 }), 5000); return () => clearTimeout(tm); }, [toast.id]);

  const muat = useCallback(async () => {
    const r = await fetch("/api/reset").then(x => x.json()).catch(() => null);
    if (r?.ok) { setScopes(r.scopes); setCounts(r.counts); }
  }, []);
  useEffect(() => { muat(); }, [muat]);

  async function jalankan() {
    if (!pilih) return;
    setSibuk(true);
    const r = await fetch("/api/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: pilih.id, konfirmasi: kata }),
    }).then(x => x.json()).catch(() => ({ ok: false, error: "Gagal terhubung ke server." }));
    setSibuk(false);
    if (r.ok) { setCounts(r.counts); setPilih(null); setKata(""); }
    tampilkan(r.ok ? "✅ " + r.message : "⚠️ " + (r.error || "Reset gagal."), !!r.ok);
  }

  const totalKartu = counts.entries ?? 0;

  return (
    <div className="space-y-4">
      <div className="card bg-base-100 p-3 shadow sm:p-4 lg:p-5">
        <h1 className="text-lg font-bold">🧹 Reset Data (Demo)</h1>
        <p className="mt-1 text-sm text-slate-500">
          Khusus Superadmin. Pilih seberapa banyak data yang ingin dikosongkan, lalu ketik kata konfirmasi.
          Semua langkah berjalan dalam satu transaksi — tidak ada kondisi setengah terhapus.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-9">
          {Object.keys(NAMA).map(k => (
            <div key={k} className="rounded-lg border border-base-200 bg-base-200/50 px-2 py-1.5">
              <div className="text-[11px] text-slate-500">{NAMA[k]}</div>
              <div className="text-base font-bold tabular-nums">{counts[k] ?? "–"}</div>
            </div>
          ))}
        </div>
        {totalKartu === 0 && (counts.assignments ?? 0) > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            ℹ️ Jadwal sedang kosong, tetapi penugasan masih ada. Buka <b>Solver</b> lalu klik Generate untuk mengisi ulang papan.
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {scopes.map(s => (
          <div key={s.id} className={`card p-4 shadow ${s.id === "seed" ? "bg-emerald-50 ring-1 ring-emerald-200" : s.id === "total" ? "bg-red-50 ring-1 ring-red-200" : "bg-base-100"}`}>
            <div className="flex items-start gap-3">
              <span className="text-2xl leading-none">{IKON[s.id] || "🧹"}</span>
              <div className="min-w-0">
                <h2 className="font-bold">{s.label}</h2>
                <p className="mt-0.5 text-sm text-slate-600">{s.ringkas}</p>
              </div>
            </div>
            <button
              className={`btn btn-sm mt-3 w-full ${s.id === "seed" ? "btn-success" : s.id === "total" ? "btn-error" : "btn-outline"}`}
              onClick={() => { setPilih(s); setKata(""); }}
            >
              {s.id === "seed" ? "♻️ Muat Ulang Data Contoh" : `Jalankan: ${s.label}`}
            </button>
          </div>
        ))}
      </div>

      <div className="card bg-base-100 p-4 text-sm shadow">
        <h2 className="font-bold">💡 Alur demo yang disarankan</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-600">
          <li><b>Kosongkan Jadwal Saja</b> — papan jadi kosong, tapi guru/mapel/kelas/penugasan masih siap.</li>
          <li>Buka <b>Solver</b> → Generate (CP-SAT) → papan terisi kembali dalam ±1 detik.</li>
          <li>Kalau ingin menguji import dari nol: <b>Kosongkan Semua Data Master</b>, lalu import file Excel template.</li>
          <li>Selesai demo: <b>Muat Ulang Data Contoh</b> untuk kembali ke kondisi awal.</li>
        </ol>
      </div>

      {pilih && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full text-2xl ${pilih.id === "seed" ? "bg-emerald-100" : "bg-red-100"}`}>
              {IKON[pilih.id] || "🧹"}
            </div>
            <h3 className="text-center text-lg font-bold">{pilih.label}</h3>
            <p className="mt-1 text-center text-sm text-slate-600">{pilih.ringkas}</p>
            <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-center text-xs text-slate-500">
              Akan terhapus: <b>{counts.entries ?? 0}</b> kartu jadwal
              {pilih.id !== "jadwal" && <> · <b>{counts.assignments ?? 0}</b> penugasan</>}
              {(pilih.id === "master" || pilih.id === "total" || pilih.id === "seed") && <> · <b>{counts.teachers ?? 0}</b> guru · <b>{counts.subjects ?? 0}</b> mapel · <b>{counts.classes ?? 0}</b> kelas</>}
              {pilih.id === "total" && <> · <b>{Math.max(0, (counts.users ?? 0) - 1)}</b> akun pegawai</>}
            </div>
            <label className="mt-4 block text-xs font-medium text-slate-500">
              Ketik <b className="text-red-600">{pilih.kata}</b> untuk melanjutkan
              <input
                autoFocus
                value={kata}
                onChange={e => setKata(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && kata.trim().toUpperCase() === pilih.kata) jalankan(); }}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-center text-base font-bold tracking-widest"
                placeholder={pilih.kata}
              />
            </label>
            <div className="mt-4 flex gap-2">
              <button className="btn btn-ghost flex-1 btn-sm" onClick={() => { setPilih(null); setKata(""); }} disabled={sibuk}>Batal</button>
              <button
                className={`btn flex-1 btn-sm ${pilih.id === "seed" ? "btn-success" : "btn-error"}`}
                disabled={sibuk || kata.trim().toUpperCase() !== pilih.kata}
                onClick={jalankan}
              >
                {sibuk ? "Memproses…" : "Ya, lanjutkan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast.msg && (
        <div className="fixed right-3 top-[70px] z-[90] w-[340px] max-w-[92vw] sm:right-5">
          <div className="flex items-start gap-2.5 rounded-xl border-l-4 bg-white p-3 shadow-2xl" style={{ borderLeftColor: toast.ok === true ? "#16a34a" : toast.ok === false ? "#dc2626" : "#334155" }}>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: toast.ok === true ? "#16a34a" : toast.ok === false ? "#dc2626" : "#334155" }}>
              {toast.ok === true ? "✓" : toast.ok === false ? "!" : "i"}
            </span>
            <p className="text-[13px] leading-snug text-slate-700">{toast.msg}</p>
            <button className="ml-auto text-slate-400 hover:text-slate-600" onClick={() => setToast({ msg: "", ok: null, id: 0 })}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
