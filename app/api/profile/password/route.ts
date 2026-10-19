import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import db, { hashPassword, verifyPassword } from "@/lib/db";
export async function POST(req: NextRequest) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ ok: false, error: "Sesi berakhir, login ulang." }, { status: 401 });
  const b = await req.json();
  const current=String(b.current_password || ""), next=String(b.new_password || ""), confirm=String(b.confirm_password || "");
  const row: any = db.prepare("SELECT password_hash FROM users WHERE id=?").get(u.id);
  if (!row || !verifyPassword(current, row.password_hash)) return NextResponse.json({ ok: false, error: "Password lama salah." }, { status: 400 });
  if (next.length < 6) return NextResponse.json({ ok: false, error: "Password baru minimal 6 karakter." }, { status: 400 });
  if (next !== confirm) return NextResponse.json({ ok: false, error: "Konfirmasi password baru tidak sama." }, { status: 400 });
  if (next === current) return NextResponse.json({ ok: false, error: "Password baru harus berbeda dari password lama." }, { status: 400 });
  db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(hashPassword(next), u.id);
  return NextResponse.json({ ok: true, message: "Password berhasil diganti. Gunakan password baru pada login berikutnya." });
}
