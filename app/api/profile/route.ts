import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import db from "@/lib/db";
export const dynamic = "force-dynamic";

function profilePayload(u: any) {
  const teacher = u.teacher_id
    ? db.prepare("SELECT id,code,name,max_jp_day,max_jp_week FROM teachers WHERE id=?").get(u.teacher_id)
    : null;
  const stats = u.teacher_id ? {
    assignments: Number((db.prepare("SELECT COUNT(*) c FROM assignments WHERE teacher_id=?").get(u.teacher_id) as any).c),
    jp_week: Number((db.prepare("SELECT COALESCE(SUM(jp_week),0) c FROM assignments WHERE teacher_id=?").get(u.teacher_id) as any).c),
    scheduled: Number((db.prepare("SELECT COUNT(*) c FROM entries e JOIN assignments a ON a.id=e.assignment_id WHERE a.teacher_id=?").get(u.teacher_id) as any).c),
  } : { assignments: 0, jp_week: 0, scheduled: 0 };
  const requests = {
    pending: Number((db.prepare("SELECT COUNT(*) c FROM move_requests WHERE requester_id=? AND status='pending'").get(u.id) as any).c),
    total: Number((db.prepare("SELECT COUNT(*) c FROM move_requests WHERE requester_id=?").get(u.id) as any).c),
  };
  return { id: u.id, username: String(u.username), display_name: String(u.display_name), role: String(u.role), teacher_id: u.teacher_id, teacher, stats, requests };
}

export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ ok: false, error: "Sesi berakhir, login ulang." }, { status: 401 });
  return NextResponse.json({ ok: true, profile: profilePayload(u) });
}

export async function PUT(req: NextRequest) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ ok: false, error: "Sesi berakhir, login ulang." }, { status: 401 });
  const b = await req.json();
  const display_name=String(b.display_name || "").trim();
  const username=String(b.username || "").trim();
  if (display_name.length < 2) return NextResponse.json({ ok: false, error: "Nama tampilan minimal 2 karakter." }, { status: 400 });
  if (username.length < 3 || /\s/.test(username)) return NextResponse.json({ ok: false, error: "Username minimal 3 karakter dan tidak boleh mengandung spasi." }, { status: 400 });
  const dup: any = db.prepare("SELECT id FROM users WHERE username=? AND id<>?").get(username, u.id);
  if (dup) return NextResponse.json({ ok: false, error: "Username sudah dipakai akun lain." }, { status: 409 });
  const info: any = db.prepare("UPDATE users SET display_name=?, username=? WHERE id=?").run(display_name, username, u.id);
  if (!info.changes) return NextResponse.json({ ok: false, error: "Profil tidak ditemukan." }, { status: 404 });
  const saved: any = db.prepare("SELECT * FROM users WHERE id=?").get(u.id);
  return NextResponse.json({ ok: true, profile: profilePayload(saved), message: "Profil tersimpan. Nama di topbar/sidebar akan tampil setelah halaman dimuat ulang." });
}
