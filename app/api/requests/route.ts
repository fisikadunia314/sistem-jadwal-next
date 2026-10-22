import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import db, { tx } from "@/lib/db";
import { allEntries, blockMate, validate } from "@/lib/schedule";
export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ ok: false }, { status: 401 });
  const rows: any[] = u.role === "admin"
    ? db.prepare("SELECT r.*, u.display_name requester FROM move_requests r JOIN users u ON u.id=r.requester_id ORDER BY (r.status='pending') DESC, r.id DESC").all()
    : db.prepare("SELECT r.*, u.display_name requester FROM move_requests r JOIN users u ON u.id=r.requester_id WHERE r.requester_id=? ORDER BY r.id DESC").all(u.id);
  const entries = allEntries();
  const withPred = rows.map(r => {
    if (r.status !== "pending") return { ...r, prediction: null };
    const e = entries.find(x => x.id === r.entry_id);
    if (!e) return { ...r, prediction: { state: "stale", label: "Kartu tidak ada di jadwal aktif" } };
    let trial = entries.map(x => ({ ...x })); const t = trial.find(x => x.id === e.id)!;
    if (r.mode === "pindah") { t.day = r.target_day; t.period = r.target_period; }
    else if (r.mode === "pindah-blok") { const o = trial.find(x => x.id === r.other_entry_id); if (!o) return { ...r, prediction: { state: "stale", label: "Pasangan blok hilang" } };
      t.day = r.target_day; t.period = r.target_period; o.day = r.target_day; o.period = r.target_period + 1; }
    else { const o = trial.find(x => x.id === r.other_entry_id); if (!o) return { ...r, prediction: { state: "stale", label: "Pasangan tukar hilang" } };
      if (blockMate(e, entries) || blockMate(o, entries)) return { ...r, prediction: { state: "invalid", label: "Melibatkan kartu blok 2JP yang sudah tetap — tidak bisa ditukar/dipecah" } };
      [t.day, t.period, o.day, o.period] = [o.day, o.period, t.day, t.period]; }
    const v = validate(trial);
    return { ...r, prediction: v.length ? { state: "invalid", label: "Menimbulkan pelanggaran: " + v.slice(0, 2).join("; ") } : { state: "ok", label: "Aman diterapkan — tidak ada bentrok baru" } };
  });
  return NextResponse.json({ ok: true, is_admin: u.role === "admin", rows: withPred });
}
export async function POST(req: NextRequest) {
  const u = await currentUser();
  if (!u || u.role !== "admin") return NextResponse.json({ ok: false, error: "Khusus Superadmin" }, { status: 403 });
  const { id, action } = await req.json();
  const r: any = db.prepare("SELECT * FROM move_requests WHERE id=? AND status='pending'").get(Number(id));
  if (!r) return NextResponse.json({ ok: false, error: "Pengajuan tidak ditemukan / sudah diproses" }, { status: 404 });
  if (action === "reject") { db.prepare("UPDATE move_requests SET status='rejected' WHERE id=?").run(r.id); return NextResponse.json({ ok: true, message: "Pengajuan ditolak." }); }
  const entries = allEntries(); const trial = entries.map(x => ({ ...x }));
  const t = trial.find(x => x.id === r.entry_id);
  if (!t) return NextResponse.json({ ok: false, error: "Kartu tidak ditemukan di jadwal aktif" }, { status: 409 });
  let o: any = null;
  if (r.mode === "pindah") { t.day = r.target_day; t.period = r.target_period; }
  else if (r.mode === "pindah-blok") { o = trial.find(x => x.id === r.other_entry_id); if (!o) return NextResponse.json({ ok: false, error: "Pasangan blok hilang" }, { status: 409 });
    t.day = r.target_day; t.period = r.target_period; o.day = r.target_day; o.period = r.target_period + 1; }
  else { o = trial.find(x => x.id === r.other_entry_id); if (!o) return NextResponse.json({ ok: false, error: "Pasangan tukar hilang" }, { status: 409 });
    const original = entries.find(x => x.id === r.entry_id)!;
    if (blockMate(original, entries) || blockMate(o, entries)) return NextResponse.json({ ok: false, error: "Kartu blok 2JP sudah tetap dan tidak bisa ditukar/dipecah oleh kartu 1JP." }, { status: 409 });
    [t.day, t.period, o.day, o.period] = [o.day, o.period, t.day, t.period]; }
  const v = validate(trial);
  if (v.length) return NextResponse.json({ ok: false, error: "Validasi ulang gagal: " + v.slice(0, 3).join("; ") }, { status: 409 });
  tx(() => {
    db.prepare("UPDATE entries SET day=?,period=? WHERE id=?").run(t.day, t.period, t.id);
    if (o) db.prepare("UPDATE entries SET day=?,period=? WHERE id=?").run(o.day, o.period, o.id);
    db.prepare("UPDATE move_requests SET status='approved' WHERE id=?").run(r.id);
  });
  return NextResponse.json({ ok: true, message: "Disetujui, diterapkan & tervalidasi." });
}
