import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import db from "@/lib/db";
import { ENTITIES } from "../route";
export const dynamic = "force-dynamic";
export async function PUT(req: NextRequest, ctx: { params: Promise<{ entity: string; id: string }> }) {
  const u = await currentUser(); if (!u || u.role !== "admin") return NextResponse.json({ ok: false, error: "Khusus Superadmin." }, { status: 403 });
  const { entity, id } = await ctx.params; const cfg = ENTITIES[entity];
  if (!cfg) return NextResponse.json({ ok: false, error: "Entitas tidak dikenal." }, { status: 404 });
  const b = await req.json();
  const vals = cfg.cols.map(c => b[c] === "" || b[c] === undefined ? null : b[c]);
  const info: any = db.prepare(`UPDATE ${cfg.table} SET ${cfg.cols.map(c => `${c}=?`).join(",")} WHERE id=?`).run(...vals, Number(id));
  return NextResponse.json({ ok: info.changes > 0, changed: Number(info.changes) });
}
export async function DELETE(_: NextRequest, ctx: { params: Promise<{ entity: string; id: string }> }) {
  const u = await currentUser(); if (!u || u.role !== "admin") return NextResponse.json({ ok: false, error: "Khusus Superadmin." }, { status: 403 });
  const { entity, id } = await ctx.params; const cfg = ENTITIES[entity];
  if (!cfg) return NextResponse.json({ ok: false, error: "Entitas tidak dikenal." }, { status: 404 });
  try {
    const info: any = db.prepare(`DELETE FROM ${cfg.table} WHERE id=?`).run(Number(id));
    return NextResponse.json({ ok: info.changes > 0, changed: Number(info.changes) });
  } catch (e: any) { return NextResponse.json({ ok: false, error: "Tidak bisa dihapus (masih dipakai data lain): " + String(e.message || e) }, { status: 400 }); }
}
