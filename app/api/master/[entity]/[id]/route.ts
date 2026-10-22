import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import db, { tx } from "@/lib/db";
import { randomTeacherColor, validateTeacherColor } from "@/lib/teacher-colors";
import { ENTITIES } from "../../entities";
export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, ctx: { params: Promise<{ entity: string; id: string }> }) {
  const u = await currentUser(); if (!u || u.role !== "admin") return NextResponse.json({ ok: false, error: "Khusus Superadmin." }, { status: 403 });
  const { entity, id } = await ctx.params; const cfg = ENTITIES[entity];
  if (!cfg) return NextResponse.json({ ok: false, error: "Entitas tidak dikenal." }, { status: 404 });
  const b = await req.json();
  if (entity === "teachers") {
    if (b.color_hex) { const v = validateTeacherColor(b.color_hex, Number(id)); if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 409 }); b.color_hex = v.color; }
    else if ("color_hex" in b) b.color_hex = randomTeacherColor(Number(id));
  }
  const vals = cfg.cols.map(c => b[c] === "" || b[c] === undefined ? null : b[c]);
  const info: any = db.prepare(`UPDATE ${cfg.table} SET ${cfg.cols.map(c => `${c}=?`).join(",")} WHERE id=?`).run(...vals, Number(id));
  return NextResponse.json({ ok: info.changes > 0, changed: Number(info.changes) });
}

function dependencies(entity: string, id: number) {
  let assignmentIds: number[] = [];
  if (entity === "assignments") assignmentIds = [id];
  else if (entity === "teachers") assignmentIds = (db.prepare("SELECT id FROM assignments WHERE teacher_id=?").all(id) as any[]).map(r => r.id);
  else if (entity === "subjects") assignmentIds = (db.prepare("SELECT id FROM assignments WHERE subject_id=?").all(id) as any[]).map(r => r.id);
  else if (entity === "classes") assignmentIds = (db.prepare("SELECT id FROM assignments WHERE class_id=?").all(id) as any[]).map(r => r.id);
  const entryCount = assignmentIds.length
    ? Number((db.prepare(`SELECT COUNT(*) c FROM entries WHERE assignment_id IN (${assignmentIds.map(() => "?").join(",")})`).get(...assignmentIds) as any).c) : 0;
  const unavailability = entity === "teachers" || entity === "classes"
    ? Number((db.prepare("SELECT COUNT(*) c FROM unavailability WHERE entity_type=? AND entity_id=?").get(entity === "teachers" ? "teacher" : "class", id) as any).c) : 0;
  const linkedUsers = entity === "teachers" ? Number((db.prepare("SELECT COUNT(*) c FROM users WHERE teacher_id=?").get(id) as any).c) : 0;
  return { assignments: assignmentIds.length, entries: entryCount, unavailability, linkedUsers, assignmentIds };
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ entity: string; id: string }> }) {
  const u = await currentUser(); if (!u || u.role !== "admin") return NextResponse.json({ ok: false, error: "Khusus Superadmin." }, { status: 403 });
  const { entity, id } = await ctx.params; const cfg = ENTITIES[entity];
  if (!cfg) return NextResponse.json({ ok: false, error: "Entitas tidak dikenal." }, { status: 404 });
  const targetId = Number(id);
  const exists: any = db.prepare(`SELECT id FROM ${cfg.table} WHERE id=?`).get(targetId);
  if (!exists) return NextResponse.json({ ok: false, error: "Data tidak ditemukan (mungkin sudah terhapus). Muat ulang tabel." }, { status: 404 });
  const dep = dependencies(entity, targetId);
  const force = req.nextUrl.searchParams.get("force") === "1";
  const hasDeps = dep.assignments > 0 || dep.entries > 0 || dep.unavailability > 0 || dep.linkedUsers > 0;
  if (hasDeps && !force) {
    return NextResponse.json({ ok: false, needsForce: true, dependencies: dep,
      error: `Data ini masih dipakai: ${dep.assignments} penugasan, ${dep.entries} kartu jadwal, ${dep.unavailability} ketidaktersediaan${entity === "teachers" ? `, ${dep.linkedUsers} akun terhubung` : ""}. Hapus data ini beserta seluruh relasinya?` }, { status: 409 });
  }
  const hasil = tx(() => {
    let removedEntries = 0, removedAssignments = 0;
    if (dep.assignmentIds.length) {
      const ph = dep.assignmentIds.map(() => "?").join(",");
      const entryIds = (db.prepare(`SELECT id FROM entries WHERE assignment_id IN (${ph})`).all(...dep.assignmentIds) as any[]).map(r => r.id);
      if (entryIds.length) {
        const eph = entryIds.map(() => "?").join(",");
        db.prepare(`DELETE FROM move_requests WHERE entry_id IN (${eph}) OR other_entry_id IN (${eph})`).run(...entryIds, ...entryIds);
      }
      removedEntries = Number((db.prepare(`DELETE FROM entries WHERE assignment_id IN (${ph})`).run(...dep.assignmentIds) as any).changes);
      if (entity !== "assignments") removedAssignments = Number((db.prepare(`DELETE FROM assignments WHERE id IN (${ph})`).run(...dep.assignmentIds) as any).changes);
    }
    if (entity === "teachers" || entity === "classes")
      db.prepare("DELETE FROM unavailability WHERE entity_type=? AND entity_id=?").run(entity === "teachers" ? "teacher" : "class", targetId);
    if (entity === "teachers") db.prepare("UPDATE users SET teacher_id=NULL WHERE teacher_id=?").run(targetId);
    const info: any = db.prepare(`DELETE FROM ${cfg.table} WHERE id=?`).run(targetId);
    return { changed: Number(info.changes), removedEntries, removedAssignments };
  });
  return NextResponse.json({ ok: hasil.changed > 0, ...hasil,
    message: hasil.changed ? `Terhapus.${hasil.removedAssignments ? ` Ikut terhapus ${hasil.removedAssignments} penugasan.` : ""}${hasil.removedEntries ? ` ${hasil.removedEntries} kartu jadwal terkait juga dihapus — jalankan Solver untuk meng-generate ulang.` : ""}` : "Tidak ada baris yang terhapus." });
}
