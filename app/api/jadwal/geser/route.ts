import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import db, { tx } from "@/lib/db";
import { allEntries, validate } from "@/lib/schedule";
export async function POST(req: NextRequest) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ ok: false, error: "Sesi berakhir, login ulang." }, { status: 401 });
  const body = await req.json();
  const entries = allEntries();
  const e = entries.find(x => x.id === Number(body.entryId));
  if (!e) return NextResponse.json({ ok: false, error: "Kartu tidak ditemukan di jadwal aktif. Papan akan disegarkan." }, { status: 404 });
  if (u.role !== "admin" && u.teacher_id !== e.teacher_id)
    return NextResponse.json({ ok: false, error: "Hanya pemilik jadwal / Superadmin." }, { status: 403 });
  let trial = entries.map(x => ({ ...x })); let other: any = null; let label = "";
  const tgt = trial.find(x => x.id === e.id)!;
  if (body.mode === "pindah-blok") {
    // geser DUA kartu 1 blok (2 JP) bersama-sama ke blok target
    other = trial.find(x => x.id === Number(body.pairId));
    if (!other || other.assignment_id !== e.assignment_id) return NextResponse.json({ ok: false, error: "Pasangan blok 2 JP tidak ditemukan." }, { status: 404 });
    const psTarget = Number(body.period);
    tgt.day = String(body.day); tgt.period = psTarget; other.day = String(body.day); other.period = psTarget + 1;
    label = `blok 2 JP ke ${tgt.day}, JP ${psTarget}-${psTarget + 1}`;
  } else if (body.mode === "pindah") {
    tgt.day = String(body.day); tgt.period = Number(body.period);
    label = `${tgt.day}, JP ${tgt.period}`;
  } else if (body.mode === "tukar") {
    other = trial.find(x => x.id === Number(body.otherId));
    if (!other) return NextResponse.json({ ok: false, error: "Pasangan tukar tidak ditemukan." }, { status: 404 });
    [tgt.day, tgt.period, other.day, other.period] = [other.day, other.period, tgt.day, tgt.period];
    label = `tukar dengan ${other.sname} (${other.cname})`;
  } else return NextResponse.json({ ok: false, error: "Mode tidak dikenal." }, { status: 400 });
  const viol = validate(trial);
  if (viol.length) return NextResponse.json({ ok: false, error: "Tidak bisa: " + viol.slice(0, 3).join("; ") }, { status: 409 });
  if (u.role !== "admin") {
    const dup = db.prepare("SELECT id FROM move_requests WHERE entry_id=? AND requester_id=? AND status='pending'").get(e.id, u.id);
    if (dup) return NextResponse.json({ ok: false, error: "Sudah ada pengajuan pending untuk kartu ini." }, { status: 409 });
    db.prepare("INSERT INTO move_requests(entry_id,requester_id,mode,target_day,target_period,other_entry_id,label,status,created_at) VALUES(?,?,?,?,?,?,?,?,datetime('now','localtime'))")
      .run(e.id, u.id, body.mode, tgt.day || body.day || null, tgt.period || body.period || null, other?.id || null,
           `${e.sname} (${e.cname}, ${e.tname}): ${e.day} JP${e.period} → ${label}`, "pending");
    return NextResponse.json({ ok: true, action: "requested", message: "Pengajuan terkirim ke Superadmin." });
  }
  // Superadmin: simpan dalam TRANSAKSI + verifikasi jumlah baris & posisi akhir
  const save = () => tx(() => {
    let changed = 0;
    changed += db.prepare("UPDATE entries SET day=?,period=? WHERE id=?").run(tgt.day, tgt.period, tgt.id).changes;
    if (other) changed += db.prepare("UPDATE entries SET day=?,period=? WHERE id=?").run(other.day, other.period, other.id).changes;
    return changed;
  });
  const changed = save();
  const expected = other ? 2 : 1;
  const saved = db.prepare("SELECT day,period FROM entries WHERE id=?").get(e.id) as any;
  let pairOk = true;
  if (body.mode === "pindah-blok" && other) { const sp: any = db.prepare("SELECT day,period FROM entries WHERE id=?").get(other.id); pairOk = !!sp && sp.day === other.day && sp.period === other.period; }
  if (changed !== expected || !pairOk || !saved || saved.day !== tgt.day || saved.period !== tgt.period)
    return NextResponse.json({ ok: false, error: `Penyimpanan tidak terverifikasi (baris berubah ${changed}/${expected}). Tidak ada perubahan yang diklaim berhasil.` }, { status: 500 });
  return NextResponse.json({ ok: true, action: "applied", changed,
    entry: { id: e.id, day: saved.day, period: saved.period },
    message: `Tersimpan & terverifikasi: ${e.sname} sekarang ${saved.day} JP ${saved.period}${body.mode === "pindah-blok" ? "-" + (saved.period + 1) + " (blok 2 JP)" : ""} (baris berubah: ${changed}).` });
}
