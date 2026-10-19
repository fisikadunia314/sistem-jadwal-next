import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import db, { hashPassword } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  const u = await currentUser();
  if (!u || u.role !== "admin") return NextResponse.json({ ok: false, error: "Khusus Superadmin." }, { status: 403 });
  const rows = (db.prepare(`SELECT usr.id,usr.username,usr.display_name,usr.role,usr.teacher_id,t.code tcode,t.name tname
    FROM users usr LEFT JOIN teachers t ON t.id=usr.teacher_id ORDER BY usr.role,usr.display_name`).all() as any[])
    .map(r => ({ ...r, username: String(r.username), display_name: String(r.display_name), role: String(r.role) }));
  return NextResponse.json({ ok: true, rows, teachers: db.prepare("SELECT id,code,name FROM teachers ORDER BY name").all() });
}
export async function POST(req: NextRequest) {
  const u = await currentUser();
  if (!u || u.role !== "admin") return NextResponse.json({ ok: false, error: "Khusus Superadmin." }, { status: 403 });
  const b = await req.json();
  const username=String(b.username || "").trim(), display_name=String(b.display_name || "").trim(), password=String(b.password || "");
  if (username.length < 3 || /\s/.test(username) || display_name.length < 2 || password.length < 6)
    return NextResponse.json({ ok: false, error: "Username min 3 tanpa spasi, nama min 2, password min 6." }, { status: 400 });
  try {
    const info: any = db.prepare("INSERT INTO users(username,password_hash,display_name,role,teacher_id) VALUES(?,?,?,?,?)")
      .run(username, hashPassword(password), display_name, b.role === "admin" ? "admin" : "pegawai", b.teacher_id ? Number(b.teacher_id) : null);
    return NextResponse.json({ ok: true, id: Number(info.lastInsertRowid), message: "Akun dibuat." });
  } catch { return NextResponse.json({ ok: false, error: "Username sudah dipakai." }, { status: 409 }); }
}
