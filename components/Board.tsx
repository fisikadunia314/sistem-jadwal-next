"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Slot = { day: string; period: number; time: string; teachable: boolean; break_label: string };
type Cls = { id: number; name: string };
type Entry = { id: number; assignment_id: number; class_id: number; class_name: string; teacher_id: number; teacher: string; tcode: string;
  subject_id: number; subject: string; scode: string; day: string; period: number; bg: string; fg: string; tbg: string; tfg: string; is_me?: boolean; mine: boolean };
type BoardData = { ok: boolean; is_admin: boolean; slots: Slot[]; classes: Cls[]; entries: Entry[];
  rules?: { unavailable: { entity_type: string; entity_id: number; day: string; period: number }[]; teacher_max_day: Record<string, number>; assignment_max_day: Record<string, number> } };
type Opt = { day: string; period: number; time: string; status: string; reason: string };

const key = (d: string, p: number) => `${d}|${p}`;
const DAYBG = ["bg-slate-800", "bg-indigo-800", "bg-teal-800", "bg-amber-700", "bg-rose-800", "bg-cyan-800"];

export default function Board() {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean | null; id: number }>({ msg: "", ok: null, id: 0 });
  const [pending, setPending] = useState<{ payload: any; label: string; entryId: number } | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [slotMap, setSlotMap] = useState<Record<string, Opt>>({});
  const [swapSet, setSwapSet] = useState<Set<number>>(new Set());
  const [dragStatus, setDragStatus] = useState("");
  // zoom vertikal: tinggi tiap baris kelas (px). Lebar papan selalu penuh layar, tidak ikut berubah.
  const [rowH, setRowH] = useState<number>(() => { try { return Number(localStorage.getItem("board_row_h")) || 28; } catch { return 28; } });
  useEffect(() => { try { localStorage.setItem("board_row_h", String(rowH)); } catch {} }, [rowH]);
  const [parked, setParked] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem("next_parked") || "[]"); } catch { return []; }
  });
  const dragStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragEntry = useRef<Entry | null>(null);
  const dragPair = useRef<number | null>(null); // id pasangan bila yang diseret kartu BLOK 2JP

  const show = useCallback((msg: string, ok: boolean | null) => setToast(t => ({ msg, ok, id: t.id + 1 })), []);
  // notifikasi pojok kanan atas, hilang sendiri
  useEffect(() => { if (!toast.id) return; const tm = setTimeout(() => setToast(t => t.id === toast.id ? { msg: "", ok: null, id: 0 } : t), 4200); return () => clearTimeout(tm); }, [toast.id]);
  const load = useCallback(async (quiet = true) => {
    const r = await fetch("/api/board");
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Gagal memuat papan");
    setBoard(d);
    if (!quiet) show("✅ Papan disegarkan dari server.", true);
  }, [show]);

  useEffect(() => { load().catch(e => show("❌ " + e.message, false)); }, [load, show]);
  useEffect(() => { localStorage.setItem("next_parked", JSON.stringify(parked)); }, [parked]);

  const days = useMemo(() => [...new Set((board?.slots || []).map(s => s.day))], [board]);
  const byCell = useMemo(() => {
    const m = new Map<string, Entry>();
    (board?.entries || []).forEach(e => m.set(`${e.class_name}|${key(e.day, e.period)}`, e));
    return m;
  }, [board]);
  // kolom papan = BLOK: 4 blok per hari, 1 blok = 2 JP berurutan
  const blocks = useMemo(() => {
    const out: any[] = [];
    for (const d of days) {
      const ss = (board?.slots || []).filter(s => s.day === d).sort((a, b) => a.period - b.period);
      for (let i = 0; i + 1 < ss.length; i += 2) out.push({ day: d, p1: ss[i].period, p2: ss[i + 1].period, idx: i / 2 + 1, break: !ss[i].teachable, firstOfDay: i === 0 });
    }
    return out;
  }, [board, days]);
  // Warna kartu mengikuti warna custom GURU. Kartu milik pengguna yang sedang login
  // diberi ring hitam tebal sebagai penanda, tanpa menutupi warna custom gurunya.
  const cardStyle = (e: Entry) => ({ background: e.bg, color: e.fg });
  const ownCls = (e: Entry) => e.is_me ? "ring-2 ring-inset ring-black font-extrabold" : "";
  const legend = useMemo(() => {
    const m = new Map<number, Entry>();
    (board?.entries || []).forEach(e => { if (!m.has(e.teacher_id)) m.set(e.teacher_id, e); });
    return [...m.values()].sort((a, b) => a.tcode.localeCompare(b.tcode));
  }, [board]);

  const findPair = (e: Entry): Entry | undefined => (board?.entries || []).find(x => x.id !== e.id && x.assignment_id === e.assignment_id && x.class_id === e.class_id && x.day === e.day && Math.abs(x.period - e.period) === 1 && Math.min(x.period, e.period) % 2 === 1);
  // ===== Analisis LOKAL instan (tanpa server) =====
  // Konteks aturan (ketidaktersediaan + batas JP harian) dikirim sekali saat papan dimuat.
  // Pewarnaan hijau/merah/ungu dihitung di browser dari data papan yang sudah ada — seketika.
  // Server TETAP memvalidasi ulang secara otoritatif saat kartu dilepas (drop), jadi hasil
  // lokal tidak pernah bisa memaksakan perubahan yang tidak sah.
  const unavailSet = useMemo(() => new Set((board?.rules?.unavailable || []).map(u => `${u.entity_type}|${u.entity_id}|${u.day}|${u.period}`)), [board]);
  function validateLocal(trial: Entry[]): string[] {
    if (!board?.rules) return ["Aturan belum termuat"];
    const viol: string[] = [];
    const seenT = new Map<string, number>(), seenC = new Map<string, number>();
    const dayT = new Map<string, number>(), dayA = new Map<string, number>();
    for (const e of trial) {
      const ks = `${e.day}|${e.period}`;
      if (seenT.has(`T|${e.teacher_id}|${ks}`)) viol.push(`Guru bentrok pada ${e.day} JP${e.period}`);
      if (seenC.has(`C|${e.class_id}|${ks}`)) viol.push(`Kelas bentrok pada ${e.day} JP${e.period}`);
      seenT.set(`T|${e.teacher_id}|${ks}`, e.id); seenC.set(`C|${e.class_id}|${ks}`, e.id);
      if (unavailSet.has(`teacher|${e.teacher_id}|${ks}`)) viol.push(`Guru tidak tersedia pada ${e.day} JP${e.period}`);
      if (unavailSet.has(`class|${e.class_id}|${ks}`)) viol.push(`Kelas tidak tersedia pada ${e.day} JP${e.period}`);
      dayT.set(`${e.teacher_id}|${e.day}`, (dayT.get(`${e.teacher_id}|${e.day}`) || 0) + 1);
      dayA.set(`${e.assignment_id}|${e.day}`, (dayA.get(`${e.assignment_id}|${e.day}`) || 0) + 1);
    }
    for (const [k, n] of dayT) { const [id, day] = k.split("|"); const mx = board.rules.teacher_max_day[id] || 0; if (mx && n > mx) viol.push(`Guru melebihi Maks JP/Hari (${n}>${mx}) pada ${day}`); }
    for (const [k, n] of dayA) { const [id, day] = k.split("|"); const mx = board.rules.assignment_max_day[id] || 0; if (mx && n > mx) viol.push(`Mapel melebihi Maks JP/Hari (${n}>${mx}) pada ${day}`); }
    return [...new Set(viol)];
  }
  // Hitung opsi satu kartu (dihitung saat kartu diangkat)
  function analyzeEntry(e: Entry, pairId?: number | null): { m: Record<string, Opt>; swaps: Set<number> } {
    const m: Record<string, Opt> = {}; const swaps = new Set<number>();
    if (!board) return { m, swaps };
    const entries = board.entries;
    if (pairId) {
      const pair = entries.find(x => x.id === pairId);
      if (pair) {
        for (const b of blocks) {
          if (b.break) continue;
          const isNow = b.day === e.day && b.p1 === Math.min(e.period, pair.period);
          const trial = entries.map(x => x.id === e.id ? { ...x, day: b.day, period: b.p1 } : x.id === pair.id ? { ...x, day: b.day, period: b.p2 } : x);
          const v = isNow ? [] : validateLocal(trial);
          const st = isNow ? "sekarang" : v.length ? "tidak" : "bisa";
          const reason = isNow ? "Blok saat ini (2 JP)" : v.length ? v[0] : "Aman dipindah sebagai blok 2 JP ke sini";
          m[key(b.day, b.p1)] = { day: b.day, period: b.p1, time: "", status: st, reason };
          m[key(b.day, b.p2)] = { day: b.day, period: b.p2, time: "", status: st, reason };
        }
      }
      return { m, swaps };
    }
    for (const sl of board.slots.filter(x => x.teachable)) {
      if (sl.day === e.day && sl.period === e.period) { m[key(sl.day, sl.period)] = { day: sl.day, period: sl.period, time: sl.time, status: "sekarang", reason: "Posisi saat ini" }; continue; }
      const trial = entries.map(x => x.id === e.id ? { ...x, day: sl.day, period: sl.period } : x);
      const v = validateLocal(trial);
      m[key(sl.day, sl.period)] = { day: sl.day, period: sl.period, time: sl.time, status: v.length ? "tidak" : "bisa", reason: v.length ? v[0] : "Aman dipindah ke sini" };
    }
    for (const o of entries) {
      if (o.id === e.id || (o.day === e.day && o.period === e.period)) continue;
      if (findPair(o)) continue; // bagian dari blok 2JP yang sudah tetap: tidak bisa ditukar/dipecah
      const trial = entries.map(x => x.id === e.id ? { ...x, day: o.day, period: o.period } : x.id === o.id ? { ...x, day: e.day, period: e.period } : x);
      if (!validateLocal(trial).length) swaps.add(o.id);
    }
    return { m, swaps };
  }

  // Indikator loading saat kartu diangkat memakai STATE agar benar-benar tampil.
  // Semua setter di dragstart dibundel React dalam satu render, jadi tidak menambah lag.
  function clearDragStatus() {
    if (dragStatusTimer.current) clearTimeout(dragStatusTimer.current);
    dragStatusTimer.current = null;
    setDragStatus("");
  }
  function onDragStart(e: Entry, pairId?: number | null) {
    setDragStatus("⏳ Mengecek slot aman…");
    // Versi useState: opsi dibaca/dihitung tepat saat kartu diangkat, lalu disimpan ke
    // state slotMap & swapSet; pewarnaan dirender React lewat cellClass.
    setDragId(e.id); dragEntry.current = e; dragPair.current = pairId || null;
    if (!board) { clearDragStatus(); return; }
    const opt = analyzeEntry(e, pairId);
    setSlotMap(opt.m); setSwapSet(opt.swaps);
    if (dragStatusTimer.current) clearTimeout(dragStatusTimer.current);
    dragStatusTimer.current = setTimeout(() => {
      setDragStatus(pairId ? "🧱 Mode BLOK: seret ke sesi (kolom) yang hijau untuk memindahkan blok utuh." : "🟢 hijau = aman • 🟣 ungu = tukar aman • 🔴 merah = tidak bisa");
    }, 450);
  }

  function cellClass(clsName: string, slot: Slot): string {
    if (!dragEntry.current || !slot.teachable) return "";
    const o = slotMap[key(slot.day, slot.period)];
    const occ = byCell.get(`${clsName}|${key(slot.day, slot.period)}`);
    if (occ && swapSet.has(occ.id) && occ.id !== dragEntry.current.id) return "bg-purple-100 ring-2 ring-inset ring-purple-500";
    if (dragEntry.current.class_name !== clsName || !o) return "";
    if (o.status === "sekarang") return "bg-blue-100 ring-2 ring-inset ring-blue-500";
    return o.status === "bisa" ? "bg-green-100 ring-2 ring-inset ring-green-500" : "bg-red-100 ring-2 ring-inset ring-red-400 opacity-80";
  }

  // PENTING: entryId DIKUNCI di sini, saat kartu dijatuhkan (dragId masih terisi).
  // Bila menunggu klik tombol modal, drag sudah berakhir & dragId sudah dibersihkan -> id kosong -> "Kartu tidak ditemukan".
  function askMove(payload: any, label: string) { if (dragId) setPending({ payload, label, entryId: dragId }); }
  async function doMove(payload: any, label: string, entryId: number) {
    show("⏳ Menyimpan ke server (transaksi + verifikasi)...", null);
    try {
      const r = await fetch("/api/jadwal/geser", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entryId, ...payload }) });
      const txt = await r.text();
      let d: any; try { d = JSON.parse(txt); } catch { throw new Error(`Balasan server bukan JSON (HTTP ${r.status})`); }
      if (!r.ok || !d.ok) throw new Error(d.error || `HTTP ${r.status}`);
      if (d.action === "applied") {
        if (payload.mode === "tukar" || payload.mode === "pindah-blok") {
          // WAJIB muat ulang seluruh papan: blok 2JP & tukar mengubah DUA kartu sekaligus.
          // Bila hanya kartu pertama yang digambar ulang, pasangannya terlihat tertinggal/misah.
          await load();
        } else {
          // pindah 1JP: perbarui state lokal langsung dari jawaban terverifikasi server
          setBoard(b => b ? { ...b, entries: b.entries.map(x => x.id === d.entry.id ? { ...x, day: d.entry.day, period: d.entry.period } : x) } : b);
        }
        setParked(p => p.filter(id => id !== entryId && id !== payload.pairId));
      }
      show("✅ " + d.message, true);
      if (d.action === "requested") show("✅ " + d.message + " Lihat menu Pengajuan Saya.", true);
    } catch (err: any) {
      show("❌ Gagal menyimpan: " + err.message, false);
      await load().catch(() => {});
    } finally { clearDragStatus(); setDragId(null); dragEntry.current = null; dragPair.current = null; setSlotMap({}); setSwapSet(new Set()); }
  }

  if (!board) return <div className="card bg-base-100 shadow p-6">Memuat papan jadwal...</div>;

  return (
    <div>
      {dragStatus && <div className="fixed left-1/2 top-[68px] z-[75] flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900/95 px-4 py-2 text-[13px] font-semibold text-white shadow-2xl pointer-events-none"><span className="animate-pulse">{dragStatus.startsWith("⏳") ? "⏳" : "✓"}</span><span>{dragStatus.replace(/^⏳ /, "")}</span></div>}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <h1 className="text-xl sm:text-2xl font-bold">🧩 Papan Jadwal Realtime</h1>
        <span className="badge badge-primary badge-outline text-[11px] sm:badge-md">{board.is_admin ? "Superadmin — drop langsung tersimpan" : "Pegawai — drop menjadi pengajuan"}</span>
        <span className="ml-auto flex items-center gap-1 text-[11px] text-base-content/70">↕️ Tinggi baris
          <button className="btn btn-xs btn-outline" title="Lebih pendek" onClick={() => setRowH(h => Math.max(16, h - 4))}>−</button>
          <input type="range" min={16} max={56} step={2} value={rowH} onChange={e => setRowH(+e.target.value)} className="range range-xs w-20 sm:w-28" />
          <button className="btn btn-xs btn-outline" title="Lebih tinggi" onClick={() => setRowH(h => Math.min(56, h + 4))}>＋</button>
          <b className="w-10 text-center">{rowH}px</b>
          <button className="btn btn-xs btn-primary" title="Hitung tinggi agar semua kelas muat satu layar (lebar tetap)" onClick={() => { const avail = window.innerHeight - 330; setRowH(Math.max(14, Math.min(40, Math.floor(avail / Math.max(1, board.classes.length))))); }}>⤢ Pas 1 Layar</button>
        </span>
        <button onClick={() => load(false)} className="btn btn-neutral btn-sm">↻ Segarkan</button>
      </div>
      <details className="mb-1">
        <summary className="cursor-pointer text-[11px] text-base-content/70">🎨 Legenda warna guru ({legend.length}) — satu guru satu warna • ⭐ = jadwal Anda — klik untuk buka/tutup</summary>
        <div className="flex flex-wrap gap-1 mt-1">{legend.map(e => (
          <span key={e.teacher_id} className="text-[10px] px-1 py-0.5 rounded border border-black/10" style={cardStyle(e)}><b>{e.tcode}</b> {e.teacher}{e.is_me ? " ⭐ Saya" : ""}</span>))}
        </div>
      </details>
      <p className="text-[11px] text-base-content/60 mb-1">🧱 <b>1 kolom = 1 sesi tersusun atas–bawah</b>: kartu setinggi satu sesi penuh adalah blok yang terseret bersama; kartu setengah sesi dapat berpasangan dengan kartu lain di separuh atas/bawahnya. Kartu hanya menampilkan kode mapel — besar kartunya menunjukkan ukurannya. Warna kartu mengikuti <b>guru</b> (satu guru satu warna, walau memegang dua mapel); kartu Anda sendiri diberi <b>ring hitam tebal</b>.</p>

      <div className="border rounded-box bg-base-100 shadow overflow-hidden">
        <table className="w-full table-fixed border-collapse text-[9px] leading-tight">
          <thead>
            <tr><th className="bg-slate-900 text-white p-1 text-left w-[46px]">Kelas</th>
              {days.map((d, di) => <th key={d} colSpan={4} className={`p-1 text-center text-white text-[11px] ${DAYBG[di % DAYBG.length]} ${di ? "border-l-4 border-l-white" : ""}`}>{d}</th>)}</tr>
            <tr><th className="bg-slate-700 text-white p-0.5 text-left font-normal">Jam →</th>
              {blocks.map((b: any) => <th key={b.day + b.p1} className={`p-0.5 text-center font-semibold ${b.break ? "bg-emerald-100 text-emerald-800" : "bg-slate-100"} ${b.firstOfDay ? "border-l-4 border-l-slate-400" : "border-l"}`}>
                {b.break ? "🕌 Istirahat" : <>JP{b.p1}–{b.p2}<br /><span className="font-normal">{board.slots.find((x: any) => x.day === b.day && x.period === b.p1)?.time?.split("-")[0]}–{board.slots.find((x: any) => x.day === b.day && x.period === b.p2)?.time?.split("-")[1]}</span></>}</th>)}</tr>
          </thead>
          <tbody>
            {board.classes.map(c => (
              <tr key={c.id} className="border-t">
                <th className="bg-slate-50 px-0.5 py-0 text-left whitespace-nowrap overflow-hidden text-ellipsis border-r" title={c.name}>{c.name}</th>
                {blocks.map((b: any) => {
                  if (b.break) return <td key={b.day + b.p1} className={`bg-emerald-50/60 ${b.firstOfDay ? "border-l-4 border-l-slate-400" : "border-l"}`} />;
                  const e1 = byCell.get(`${c.name}|${key(b.day, b.p1)}`), e2 = byCell.get(`${c.name}|${key(b.day, b.p2)}`);
                  const merged = e1 && e2 && e1.assignment_id === e2.assignment_id ? e1 : null;
                  const pairId = merged ? e2!.id : null;
                  const dropProps = (p: number) => ({
                    onDragOver: (ev: any) => { if (dragId) { const o = slotMap[key(b.day, p)]; const occ = byCell.get(`${c.name}|${key(b.day, p)}`);
                      const swapOk = !dragPair.current && occ && swapSet.has(occ.id) && occ.id !== dragId;
                      const moveOk = dragEntry.current?.class_name === c.name && o?.status === "bisa";
                      const blockOk = dragPair.current && dragEntry.current?.class_name === c.name && slotMap[key(b.day, b.p1)]?.status === "bisa";
                      if (swapOk || moveOk || blockOk) { ev.preventDefault(); show(dragPair.current ? `🟢 ${b.day} JP${b.p1}-${b.p2} aman untuk blok 2JP — lepas untuk ` + (board.is_admin ? "menyimpan" : "mengajukan") : swapOk ? "🟣 Tukar aman — lepas untuk " + (board.is_admin ? "menukar" : "mengajukan tukar") : `🟢 ${b.day} JP${p} masih kosong/aman — lepas untuk ` + (board.is_admin ? "menyimpan di JP ini (berpasangan dalam blok)" : "mengajukan ke JP ini"), true); }
                      else if (dragEntry.current?.class_name === c.name && o && o.status === "tidak") show(`🔴 ${b.day} JP${p} — ${o.reason}`, false); } },
                    onDrop: (ev: any) => { ev.preventDefault(); if (!dragId || !dragEntry.current) return;
                      if (dragPair.current) { if (dragEntry.current.class_name === c.name && slotMap[key(b.day, b.p1)]?.status === "bisa") askMove({ mode: "pindah-blok", pairId: dragPair.current, day: b.day, period: b.p1 }, `blok 2 JP ${dragEntry.current.subject} ke ${b.day} JP${b.p1}-${b.p2}`); else show("🔴 Blok ini tidak aman untuk blok 2 JP: " + (slotMap[key(b.day, b.p1)]?.reason || "tidak aman"), false); return; }
                      const occ = byCell.get(`${c.name}|${key(b.day, p)}`);
                      if (occ && occ.id === dragId) { show("ℹ️ Itu posisi kartu sendiri.", null); return; }
                      const occMate = occ ? findPair(occ) : undefined;
                      if (occ && occMate && occMate.id !== dragId) { show(`🔴 ${occ.scode} adalah bagian dari blok 2JP yang sudah tetap — kartu 1JP tidak bisa menukar/memecah blok 2JP. Pilih slot kosong atau kartu 1JP lain.`, false); return; }
                      // dijatuhkan di atas kartu 1JP yang JP pasangannya masih KOSONG -> GABUNG dalam blok yang sama (isi JP kosongnya), bukan tukar
                      const pp = p === b.p1 ? b.p2 : b.p1;
                      if (occ && occ.id !== dragId && !byCell.get(`${c.name}|${key(b.day, pp)}`) && dragEntry.current.class_name === c.name && slotMap[key(b.day, pp)]?.status === "bisa") { askMove({ mode: "pindah", day: b.day, period: pp }, `gabung di ${b.day} bersama ${occ.scode} (satu sesi JP${b.p1}-${b.p2}) — kartu ini mengisi JP${pp} yang kosong`); return; }
                      if (occ && swapSet.has(occ.id)) askMove({ mode: "tukar", otherId: occ.id }, `tukar dengan ${occ.subject} (${occ.class_name})`);
                      else if (dragEntry.current.class_name === c.name && slotMap[key(b.day, p)]?.status === "bisa") askMove({ mode: "pindah", day: b.day, period: p }, `pindah ke ${b.day} JP${p} (berpasangan dengan isi JP pasangannya dalam sesi JP${b.p1}-${b.p2})`);
                      else show("🔴 Tidak bisa diletakkan di JP ini: " + (occ ? "JP ini sudah terisi dan tidak bisa ditukar" : (slotMap[key(b.day, p)]?.reason || "slot tidak aman")), false); },
                  });
                  const cellColor = (p: number) => { const sl = { day: b.day, period: p, teachable: true } as Slot; return cellClass(c.name, sl); };
                  return (
                    <td key={b.day + b.p1} className={`p-0 align-top ${b.firstOfDay ? "border-l-4 border-l-slate-400" : "border-l"}`}>
                      <div className="flex flex-col" style={{ height: rowH }}>
                        {merged && (parked.includes(e1!.id) || parked.includes(e2!.id)) ? (
                          <div className="flex-1 flex items-center justify-center bg-amber-100 text-amber-800 font-bold">🅿️ di cadangan</div>
                        ) : merged ? (
                          <div {...dropProps(b.p1)} className="flex flex-1"><div draggable={merged.mine} onDragStart={() => onDragStart(merged, pairId)} onDragEnd={() => { clearDragStatus(); setDragId(null); dragEntry.current = null; dragPair.current = null; setSlotMap({}); setSwapSet(new Set()); }}
                            className={`flex-1 flex items-center gap-0.5 px-0.5 overflow-hidden border border-black/20 ${cellColor(b.p1)} ${ownCls(merged)} ${merged.mine ? "cursor-grab active:cursor-grabbing" : "opacity-90"}`}
                            style={cardStyle(merged)} title={`${merged.subject} — ${merged.teacher} • ${merged.day} JP${b.p1}-${b.p2} (BLOK 2 JP, terseret bersama)`}>
                            <b className="flex-1 truncate text-center">{merged.scode}</b>
                          </div></div>
                        ) : [b.p1, b.p2].map(p => { const e = byCell.get(`${c.name}|${key(b.day, p)}`); const isParked = e && parked.includes(e.id); return (
                          <div key={p} {...dropProps(p)} className={`flex-1 flex items-center overflow-hidden px-0.5 ${p === b.p2 ? "border-t border-dashed border-slate-300" : ""} ${cellColor(p)}`}>
                            {e && !isParked ? (
                              <div draggable={e.mine} onDragStart={() => onDragStart(e)} onDragEnd={() => { clearDragStatus(); setDragId(null); dragEntry.current = null; dragPair.current = null; setSlotMap({}); setSwapSet(new Set()); }}
                                className={`flex w-full items-center gap-0.5 rounded-sm px-0.5 overflow-hidden border border-black/15 ${ownCls(e)} ${e.mine ? "cursor-grab active:cursor-grabbing" : "opacity-90"}`}
                                style={cardStyle(e)} title={`${e.subject} — ${e.teacher} • ${e.day} JP ${e.period} (1 JP)`}>
                                <b className="flex-1 truncate text-center">{e.scode}</b>
                              </div>
                            ) : isParked ? <span className="text-amber-700">🅿️</span> : null}
                          </div> ); })}
                      </div>
                    </td>);
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 border-2 border-dashed border-amber-300 bg-amber-50 rounded-xl p-3 min-h-[84px]"
        onDragOver={ev => { if (dragId) ev.preventDefault(); }}
        onDrop={ev => { ev.preventDefault(); clearDragStatus(); if (dragId) { const ids = dragPair.current ? [dragId, dragPair.current] : [dragId]; setParked(p => [...p, ...ids.filter(i => !p.includes(i))]); show(dragPair.current ? "🅿️ Blok 2JP diparkir utuh di Area Cadangan (belum tersimpan). Seret kembali sebagai satu kesatuan ke sesi hijau." : "🅿️ Kartu diparkir di Area Cadangan (belum tersimpan). Seret kembali ke sel hijau untuk menerapkan.", true); } setDragId(null); dragPair.current = null; setSlotMap({}); setSwapSet(new Set()); }}>
        <div className="font-bold text-amber-800 text-sm">🅿️ Area Cadangan / Parkir — tempat mikir-mikir</div>
        <p className="text-xs text-amber-700 mb-2">Seret kartu ke sini untuk memarkir sementara (belum tersimpan ke server). Seret kembali ke sel hijau untuk menerapkan, atau ke slot asalnya untuk batal parkir.</p>
        <div className="flex flex-wrap gap-1">
          {parked.map(id => { const e = board.entries.find(x => x.id === id); if (!e) return null;
            const mate = findPair(e);
            if (mate && parked.includes(mate.id)) {
              if (e.period > mate.period) return null; // tampilkan sekali saja sebagai satu kesatuan 2JP
              return (
                <div key={id} draggable={e.mine} onDragStart={() => onDragStart(e, mate.id)} onDragEnd={() => { clearDragStatus(); setDragId(null); dragEntry.current = null; dragPair.current = null; setSlotMap({}); setSwapSet(new Set()); }}
                  className={`rounded-md px-1.5 py-1 leading-tight border border-black/15 cursor-grab text-[11px] ${ownCls(e)}`} style={cardStyle(e)} title="Blok 2JP — terseret sebagai satu kesatuan">
                  <b>{e.scode}</b> • {e.class_name} • asal {e.day} JP{e.period}-{mate.period}
                </div>);
            }
            return (
            <div key={id} draggable={e.mine} onDragStart={() => onDragStart(e)} onDragEnd={() => { clearDragStatus(); setDragId(null); dragEntry.current = null; dragPair.current = null; setSlotMap({}); setSwapSet(new Set()); }}
              className={`rounded-md px-1.5 py-1 leading-tight border border-black/15 cursor-grab text-[11px] ${ownCls(e)}`} style={cardStyle(e)}>
              <b>{e.scode}</b> • {e.class_name} • asal {e.day} JP{e.period}
            </div>); })}
          {!parked.length && <span className="text-xs text-amber-600">(kosong)</span>}
        </div>
      </div>

      {toast.msg && <div className="toast-in fixed right-3 top-[70px] sm:right-5 z-[70] w-[340px] max-w-[92vw]">
        <div className="flex items-start gap-2.5 rounded-xl bg-white p-3 shadow-2xl border-l-4" style={{ borderLeftColor: toast.ok === true ? "#16a34a" : toast.ok === false ? "#dc2626" : "#334155" }}>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white text-sm font-bold" style={{ background: toast.ok === true ? "#16a34a" : toast.ok === false ? "#dc2626" : "#334155" }}>{toast.ok === true ? "✓" : toast.ok === false ? "!" : "i"}</span>
          <p className="text-[13px] leading-snug text-slate-700">{toast.msg}</p>
          <button className="ml-auto text-slate-400 hover:text-slate-600" onClick={() => setToast({ msg: "", ok: null, id: 0 })}>✕</button>
        </div></div>}
      {pending && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl">❓</div>
          <h3 className="text-lg font-bold">{board.is_admin ? "Terapkan perubahan?" : "Kirim pengajuan?"}</h3>
          <p className="mt-1 text-sm text-slate-600">{pending.label}.{board.is_admin ? "" : " Jadwal berubah setelah Superadmin menyetujui."}</p>
          <div className="mt-4 flex justify-center gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => setPending(null)}>Batal</button>
            <button className="btn btn-primary btn-sm" onClick={() => { const q = pending; setPending(null); doMove(q.payload, q.label, q.entryId); }}>{board.is_admin ? "Ya, Terapkan" : "Ya, Ajukan"}</button>
          </div>
        </div></div>}
    </div>
  );
}
