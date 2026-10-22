import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import db from "@/lib/db";
import { randomTeacherColor, validateTeacherColor } from "@/lib/teacher-colors";
export const dynamic = "force-dynamic";
import { ENTITIES } from "../entities";
export async function GET(_: NextRequest, ctx: { params: Promise<{ entity: string }> }) {
  const u = await currentUser(); if (!u) return NextResponse.json({ ok: false, error: "Login dulu." }, { status: 401 });
  const { entity } = await ctx.params; const cfg = ENTITIES[entity];
  if (!cfg) return NextResponse.json({ ok: false, error: "Entitas tidak dikenal." }, { status: 404 });
  let rows: any[];
  if (entity === "assignments") rows = db.prepare(`SELECT a.*, t.name tname, t.code tcode, s.code scode, c.name cname FROM assignments a JOIN teachers t ON t.id=a.teacher_id JOIN subjects s ON s.id=a.subject_id JOIN classes c ON c.id=a.class_id ORDER BY t.name, c.name`).all() as any[];
  else rows = db.prepare(`SELECT * FROM ${cfg.table} ORDER BY id`).all() as any[];
  const refs = entity === "assignments" ? {
    teachers: db.prepare("SELECT id,code,name FROM teachers ORDER BY name").all(),
    subjects: db.prepare("SELECT id,code,name FROM subjects ORDER BY name").all(),
    classes: db.prepare("SELECT id,name FROM classes ORDER BY name").all(),
  } : undefined;
  return NextResponse.json({ ok: true, rows, refs });
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ entity: string }> }) {
  const u = await currentUser(); if (!u || u.role !== "admin") return NextResponse.json({ ok: false, error: "Khusus Superadmin." }, { status: 403 });
  const { entity } = await ctx.params; const cfg = ENTITIES[entity];
  if (!cfg) return NextResponse.json({ ok: false, error: "Entitas tidak dikenal." }, { status: 404 });
  const b = await req.json();
  if (entity === "teachers") {
    if (b.color_hex) { const v = validateTeacherColor(b.color_hex); if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 409 }); b.color_hex = v.color; }
    else b.color_hex = randomTeacherColor();
  }
  const vals = cfg.cols.map(c => b[c] === "" || b[c] === undefined ? null : b[c]);
  try {
    const info: any = db.prepare(`INSERT INTO ${cfg.table}(${cfg.cols.join(",")}) VALUES(${cfg.cols.map(() => "?").join(",")})`).run(...vals);
    return NextResponse.json({ ok: true, id: Number(info.lastInsertRowid) });
  } catch (e: any) { return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 400 }); }
}
