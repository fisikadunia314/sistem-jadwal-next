import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import db from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  const u = await currentUser(); if (!u) return NextResponse.json({ ok: false, error: "Login dulu." }, { status: 401 });
  const rows = db.prepare("SELECT * FROM unavailability").all() as any[];
  return NextResponse.json({ ok: true, rows,
    teachers: db.prepare("SELECT id,code,name FROM teachers ORDER BY name").all(),
    classes: db.prepare("SELECT id,name FROM classes ORDER BY name").all(),
    me_teacher: u.teacher_id, is_admin: u.role === "admin" });
}
export async function POST(req: NextRequest) {
  const u = await currentUser(); if (!u) return NextResponse.json({ ok: false, error: "Login dulu." }, { status: 401 });
  const b = await req.json();
  const et = String(b.entity_type), eid = Number(b.entity_id);
  if (u.role !== "admin" && !(et === "teacher" && eid === u.teacher_id)) return NextResponse.json({ ok: false, error: "Pegawai hanya mengatur ketidaktersediaannya sendiri." }, { status: 403 });
  const ex: any = db.prepare("SELECT rowid FROM unavailability WHERE entity_type=? AND entity_id=? AND day=? AND period=?").get(et, eid, String(b.day), Number(b.period));
  if (ex) db.prepare("DELETE FROM unavailability WHERE rowid=?").run(ex.rowid);
  else db.prepare("INSERT INTO unavailability VALUES(?,?,?,?)").run(et, eid, String(b.day), Number(b.period));
  return NextResponse.json({ ok: true, off: !ex });
}
