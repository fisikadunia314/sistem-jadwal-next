import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import db, { tx } from "@/lib/db";
export const dynamic = "force-dynamic";
const TABLES: Record<string, string[]> = {
  teachers: ["id", "code", "name", "max_jp_day", "max_jp_week"],
  subjects: ["id", "code", "name", "prefer_pagi"],
  classes: ["id", "name"],
  assignments: ["id", "teacher_id", "subject_id", "class_id", "jp_week", "max_jp_day"],
};
// Export: GET /api/excel/teachers -> file .xlsx ; Jadwal: GET /api/excel/jadwal
export async function GET(_: NextRequest, ctx: { params: Promise<{ type: string }> }) {
  const u = await currentUser(); if (!u) return NextResponse.json({ ok: false, error: "Login dulu." }, { status: 401 });
  const { type } = await ctx.params;
  const XLSX = await import("xlsx");
  let rows: any[];
  if (type === "jadwal") {
    rows = db.prepare(`SELECT c.name Kelas, e.day Hari, e.period JP, s.code Mapel, s.name NamaMapel, t.code Guru, t.name NamaGuru
      FROM entries e JOIN assignments a ON a.id=e.assignment_id JOIN teachers t ON t.id=a.teacher_id
      JOIN subjects s ON s.id=a.subject_id JOIN classes c ON c.id=a.class_id ORDER BY c.name, e.day, e.period`).all() as any[];
  } else if (TABLES[type]) rows = db.prepare(`SELECT * FROM ${type}`).all() as any[];
  else return NextResponse.json({ ok: false, error: "Tipe tidak dikenal." }, { status: 404 });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), type);
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buf, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${type}.xlsx"` } });
}
// Import: POST form-data field "file" -> baris ditambahkan (id diabaikan bila bentrok)
export async function POST(req: NextRequest, ctx: { params: Promise<{ type: string }> }) {
  const u = await currentUser(); if (!u || u.role !== "admin") return NextResponse.json({ ok: false, error: "Khusus Superadmin." }, { status: 403 });
  const { type } = await ctx.params; const cols = TABLES[type];
  if (!cols) return NextResponse.json({ ok: false, error: "Import hanya untuk guru/mapel/kelas/penugasan." }, { status: 400 });
  const form = await req.formData(); const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ ok: false, error: "File tidak ada." }, { status: 400 });
  const XLSX = await import("xlsx");
  const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets[wb.SheetNames[0]]);
  const useCols = cols.filter(c => c !== "id" || rows.some(r => r.id));
  let n = 0;
  tx(() => { for (const r of rows) { try { db.prepare(`INSERT OR REPLACE INTO ${type}(${useCols.join(",")}) VALUES(${useCols.map(() => "?").join(",")})`).run(...useCols.map(c => r[c] ?? null)); n++; } catch {} } });
  return NextResponse.json({ ok: true, imported: n, message: `${n} baris terimpor ke ${type}.` });
}
