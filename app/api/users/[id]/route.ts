import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import db, { hashPassword } from "@/lib/db";
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const u = await currentUser();
  if (!u || u.role !== "admin") return NextResponse.json({ ok: false, error: "Khusus Superadmin." }, { status: 403 });
  const { id } = await ctx.params; const targetId = Number(id); const b = await req.json();
  const username=String(b.username || "").trim(), display_name=String(b.display_name || "").trim();
  if (username.length < 3 || /\s/.test(username) || display_name.length < 2) return NextResponse.json({ ok: false, error: "Username min 3 tanpa spasi dan nama min 2." }, { status: 400 });
  const dup: any = db.prepare("SELECT id FROM users WHERE username=? AND id<>?").get(username, targetId);
  if (dup) return NextResponse.json({ ok: false, error: "Username sudah dipakai akun lain." }, { status: 409 });
  if (targetId === u.id && b.role !== "admin") return NextResponse.json({ ok: false, error: "Anda tidak dapat menurunkan peran akun sendiri." }, { status: 400 });
  const role = b.role === "admin" ? "admin" : "pegawai";
  if (targetId !== u.id || role === "admin") {
    const target: any = db.prepare("SELECT role FROM users WHERE id=?").get(targetId);
    if (target?.role === "admin" && role !== "admin" && Number((db.prepare("SELECT COUNT(*) c FROM users WHERE role='admin'").get() as any).c) <= 1)
      return NextResponse.json({ ok: false, error: "Tidak boleh menurunkan Superadmin terakhir." }, { status: 400 });
  }
  db.prepare("UPDATE users SET username=?,display_name=?,role=?,teacher_id=? WHERE id=?")
    .run(username, display_name, role, b.teacher_id ? Number(b.teacher_id) : null, targetId);
  if (b.password) {
    if (String(b.password).length < 6) return NextResponse.json({ ok: false, error: "Password reset minimal 6 karakter." }, { status: 400 });
    db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(hashPassword(String(b.password)), targetId);
  }
  return NextResponse.json({ ok: true, message: "Akun diperbarui." });
}
export async function DELETE(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const u = await currentUser();
  if (!u || u.role !== "admin") return NextResponse.json({ ok: false, error: "Khusus Superadmin." }, { status: 403 });
  const { id } = await ctx.params; const targetId = Number(id);
  if (targetId === u.id) return NextResponse.json({ ok: false, error: "Akun sendiri tidak dapat dihapus." }, { status: 400 });
  const target: any = db.prepare("SELECT role FROM users WHERE id=?").get(targetId);
  if (!target) return NextResponse.json({ ok: false, error: "Akun tidak ditemukan." }, { status: 404 });
  if (target.role === "admin" && Number((db.prepare("SELECT COUNT(*) c FROM users WHERE role='admin'").get() as any).c) <= 1)
    return NextResponse.json({ ok: false, error: "Superadmin terakhir tidak dapat dihapus." }, { status: 400 });
  const info: any = db.prepare("DELETE FROM users WHERE id=?").run(targetId);
  return NextResponse.json({ ok: info.changes > 0, message: "Akun dihapus." });
}
