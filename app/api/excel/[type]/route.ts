import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import db, { tx } from "@/lib/db";
import { randomTeacherColor, validateTeacherColor } from "@/lib/teacher-colors";
import { SHEETS, norm, mapRow, blankRow, num } from "../route-utils";
export const dynamic = "force-dynamic";

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
type Report = { sheet: string; dibaca: number; baru: number; diperbarui: number; dilewati: number; errors: string[] };
const newReport = (sheet: string): Report => ({ sheet, dibaca: 0, baru: 0, diperbarui: 0, dilewati: 0, errors: [] });
const err = (r: Report, row: number, msg: string) => { r.dilewati++; if (r.errors.length < 20) r.errors.push(`Baris ${row}: ${msg}`); };

function importTeachers(raw: any[]): Report {
  const r = newReport("Guru");
  for (let i = 0; i < raw.length; i++) {
    if (blankRow(raw[i])) continue; r.dibaca++;
    const x = mapRow(raw[i], { code: ["kodeguru", "kode", "code"], name: ["namaguru", "nama", "name"], max_jp_day: ["maksjphari", "maxjpday", "maksjpperhari"], max_jp_week: ["maksjpminggu", "maxjpweek", "maksjpperminggu"], color_hex: ["warnahex", "warna", "colorhex", "color"] });
    if (!String(x.code || "").trim() || !String(x.name || "").trim()) { err(r, i + 2, "KodeGuru dan NamaGuru wajib diisi"); continue; }
    const ex: any = db.prepare("SELECT id,color_hex FROM teachers WHERE LOWER(code)=LOWER(?)").get(String(x.code).trim());
    let color = ex?.color_hex || null;
    if (String(x.color_hex || "").trim()) { const v = validateTeacherColor(x.color_hex, ex?.id); if (!v.ok) { err(r, i + 2, v.error); continue; } color = v.color; }
    if (!color) color = randomTeacherColor(ex?.id);
    if (ex) { db.prepare("UPDATE teachers SET name=?,max_jp_day=?,max_jp_week=?,color_hex=? WHERE id=?").run(String(x.name).trim(), num(x.max_jp_day), num(x.max_jp_week), color, ex.id); r.diperbarui++; }
    else { db.prepare("INSERT INTO teachers(code,name,max_jp_day,max_jp_week,color_hex) VALUES(?,?,?,?,?)").run(String(x.code).trim(), String(x.name).trim(), num(x.max_jp_day), num(x.max_jp_week), color); r.baru++; }
  }
  return r;
}
function importSubjects(raw: any[]): Report {
  const r = newReport("Mapel");
  for (let i = 0; i < raw.length; i++) {
    if (blankRow(raw[i])) continue; r.dibaca++;
    const x = mapRow(raw[i], { code: ["kodemapel", "kode", "code"], name: ["namamapel", "nama", "name"], prefer_pagi: ["preferpagi", "pagi", "prefer"] });
    if (!String(x.code || "").trim() || !String(x.name || "").trim()) { err(r, i + 2, "KodeMapel dan NamaMapel wajib diisi"); continue; }
    const ex: any = db.prepare("SELECT id FROM subjects WHERE LOWER(code)=LOWER(?)").get(String(x.code).trim());
    if (ex) { db.prepare("UPDATE subjects SET name=?,prefer_pagi=? WHERE id=?").run(String(x.name).trim(), num(x.prefer_pagi), ex.id); r.diperbarui++; }
    else { db.prepare("INSERT INTO subjects(code,name,prefer_pagi) VALUES(?,?,?)").run(String(x.code).trim(), String(x.name).trim(), num(x.prefer_pagi)); r.baru++; }
  }
  return r;
}
function importClasses(raw: any[]): Report {
  const r = newReport("Kelas");
  for (let i = 0; i < raw.length; i++) {
    if (blankRow(raw[i])) continue; r.dibaca++;
    const x = mapRow(raw[i], { name: ["namakelas", "nama", "name", "kelas"] });
    if (!String(x.name || "").trim()) { err(r, i + 2, "NamaKelas wajib diisi"); continue; }
    const ex: any = db.prepare("SELECT id FROM classes WHERE LOWER(name)=LOWER(?)").get(String(x.name).trim());
    if (ex) r.diperbarui++; else { db.prepare("INSERT INTO classes(name) VALUES(?)").run(String(x.name).trim()); r.baru++; }
  }
  return r;
}
const findTeacher = (v: any) => (db.prepare("SELECT id FROM teachers WHERE id=? OR LOWER(code)=LOWER(?) OR LOWER(name)=LOWER(?)").get(num(v, -1), String(v || "").trim(), String(v || "").trim()) as any)?.id;
const findSubject = (v: any) => (db.prepare("SELECT id FROM subjects WHERE id=? OR LOWER(code)=LOWER(?) OR LOWER(name)=LOWER(?)").get(num(v, -1), String(v || "").trim(), String(v || "").trim()) as any)?.id;
const findClass = (v: any) => (db.prepare("SELECT id FROM classes WHERE id=? OR LOWER(name)=LOWER(?)").get(num(v, -1), String(v || "").trim()) as any)?.id;
function importAssignments(raw: any[]): Report {
  const r = newReport("Penugasan");
  for (let i = 0; i < raw.length; i++) {
    if (blankRow(raw[i])) continue; r.dibaca++;
    const x = mapRow(raw[i], { teacher: ["kodeguru", "guru", "teacherid", "teacher"], subject: ["kodemapel", "mapel", "subjectid", "subject"], klass: ["namakelas", "kelas", "classid", "class"], jp_week: ["jpminggu", "jp", "jpweek"], max_jp_day: ["maksjphari", "maxjpday"] });
    const t = findTeacher(x.teacher), s = findSubject(x.subject), c = findClass(x.klass);
    if (!t) { err(r, i + 2, `Guru "${x.teacher ?? ""}" tidak ditemukan di sheet Guru/database`); continue; }
    if (!s) { err(r, i + 2, `Mapel "${x.subject ?? ""}" tidak ditemukan di sheet Mapel/database`); continue; }
    if (!c) { err(r, i + 2, `Kelas "${x.klass ?? ""}" tidak ditemukan di sheet Kelas/database`); continue; }
    if (num(x.jp_week) <= 0) { err(r, i + 2, "JPMinggu harus lebih dari 0"); continue; }
    const ex: any = db.prepare("SELECT id FROM assignments WHERE teacher_id=? AND subject_id=? AND class_id=?").get(t, s, c);
    if (ex) { db.prepare("UPDATE assignments SET jp_week=?,max_jp_day=? WHERE id=?").run(num(x.jp_week), num(x.max_jp_day, 2), ex.id); r.diperbarui++; }
    else { db.prepare("INSERT INTO assignments(teacher_id,subject_id,class_id,jp_week,max_jp_day) VALUES(?,?,?,?,?)").run(t, s, c, num(x.jp_week), num(x.max_jp_day, 2)); r.baru++; }
  }
  return r;
}
function importUnavailability(raw: any[]): Report {
  const r = newReport("Ketidaktersediaan");
  for (let i = 0; i < raw.length; i++) {
    if (blankRow(raw[i])) continue; r.dibaca++;
    const x = mapRow(raw[i], { type: ["tipe", "jenis", "entitytype"], who: ["kodeataunama", "kode", "nama", "entitas", "entityid"], day: ["hari", "day"], period: ["jp", "period", "jamke"] });
    const tipe = norm(x.type).startsWith("kelas") ? "class" : norm(x.type).startsWith("guru") ? "teacher" : "";
    const id = tipe === "teacher" ? findTeacher(x.who) : tipe === "class" ? findClass(x.who) : null;
    const day = DAYS.find(d => norm(d) === norm(x.day)), period = num(x.period);
    if (!tipe) { err(r, i + 2, "Tipe harus 'guru' atau 'kelas'"); continue; }
    if (!id) { err(r, i + 2, `"${x.who ?? ""}" tidak ditemukan`); continue; }
    if (!day || period < 1 || period > 8 || (day === "Jumat" && [5, 6].includes(period))) { err(r, i + 2, "Hari/JP tidak berlaku (Jumat hanya JP1-4 dan JP7-8)"); continue; }
    const ex: any = db.prepare("SELECT rowid FROM unavailability WHERE entity_type=? AND entity_id=? AND day=? AND period=?").get(tipe, id, day, period);
    if (ex) r.diperbarui++; else { db.prepare("INSERT INTO unavailability VALUES(?,?,?,?)").run(tipe, id, day, period); r.baru++; }
  }
  return r;
}
const IMPORTERS: Record<string, (raw: any[]) => Report> = { teachers: importTeachers, subjects: importSubjects, classes: importClasses, assignments: importAssignments, unavailability: importUnavailability };

function templateWorkbook(XLSX: any, only?: string) {
  const wb = XLSX.utils.book_new();
  const guide = [
    ["FORMAT IMPORT SISTEM JADWAL"],
    ["Satu file ini dapat berisi semua bagian. Isi tiap sheet mulai baris ke-2; jangan mengubah nama sheet dan judul kolom pada baris pertama."],
    ["Urutan pemrosesan otomatis: Guru -> Mapel -> Kelas -> Penugasan -> Ketidaktersediaan. Penugasan cukup ditulis dengan KodeGuru, KodeMapel, dan NamaKelas (bukan ID angka)."],
    ["Baris kosong diabaikan. Data yang kodenya sudah ada akan DIPERBARUI, bukan diduplikat. Setelah import, aplikasi menampilkan laporan baru/diperbarui/dilewati beserta alasannya."],
    [""],
    ["Contoh Guru", "KodeGuru=G01 | NamaGuru=Budi Santoso | MaksJPHari=6 | MaksJPMinggu=0 (0 = tidak dibatasi) | WarnaHEX=#2563EB (opsional; kosong = dibuat unik otomatis)"],
    ["Contoh Mapel", "KodeMapel=MTK | NamaMapel=Matematika | PreferPagi=1 (1 = utamakan pagi, 0 = tidak)"],
    ["Contoh Kelas", "NamaKelas=VII-A"],
    ["Contoh Penugasan", "KodeGuru=G01 | KodeMapel=MTK | NamaKelas=VII-A | JPMinggu=4 | MaksJPHari=2"],
    ["Contoh Ketidaktersediaan", "Tipe=guru | KodeAtauNama=G01 | Hari=Jumat | JP=7"],
    [""],
    ["Tips", "Download template ini, hapus contoh hanya bila ada di sheet data (contoh di sheet Petunjuk tidak terimpor), isi data asli, simpan sebagai .xlsx, lalu gunakan tombol Import Semua Sheet di halaman Data Master."],
  ];
  if (!only) { const ws = XLSX.utils.aoa_to_sheet(guide); ws["!cols"] = [{ wch: 28 }, { wch: 110 }]; XLSX.utils.book_append_sheet(wb, ws, "Petunjuk"); }
  for (const [key, cfg] of Object.entries(SHEETS)) {
    if (only && only !== key) continue;
    const ws = XLSX.utils.aoa_to_sheet([cfg.headers]);
    ws["!cols"] = cfg.headers.map(h => ({ wch: Math.max(16, h.length + 4) }));
    XLSX.utils.book_append_sheet(wb, ws, cfg.sheet);
  }
  return wb;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ type: string }> }) {
  const u = await currentUser(); if (!u) return NextResponse.json({ ok: false, error: "Login dulu." }, { status: 401 });
  const { type } = await ctx.params; const XLSX = await import("xlsx");
  if (type === "template" || type.startsWith("template-")) {
    if (u.role !== "admin") return NextResponse.json({ ok: false, error: "Khusus Superadmin." }, { status: 403 });
    const only = type.startsWith("template-") ? type.slice(9) : undefined;
    const wb = templateWorkbook(XLSX, only && SHEETS[only as keyof typeof SHEETS] ? only : undefined);
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buf, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="template-import-jadwal.xlsx"` } });
  }
  if (type === "jadwal") {
    // Format cetak: satu sheet per tingkat, sesi 2 JP, kode mapel + nama guru (lihat lib/export-jadwal.ts).
    const { buildJadwalWorkbook } = await import("@/lib/export-jadwal");
    const buf = await buildJadwalWorkbook();
    return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="jadwal-pelajaran.xlsx"` } });
  }
  let rows: any[];
  if (type === "teachers") rows = db.prepare("SELECT code KodeGuru,name NamaGuru,max_jp_day MaksJPHari,max_jp_week MaksJPMinggu,color_hex WarnaHEX FROM teachers ORDER BY code").all() as any[];
  else if (type === "subjects") rows = db.prepare("SELECT code KodeMapel,name NamaMapel,prefer_pagi PreferPagi FROM subjects ORDER BY code").all() as any[];
  else if (type === "classes") rows = db.prepare("SELECT name NamaKelas FROM classes ORDER BY name").all() as any[];
  else if (type === "assignments") rows = db.prepare(`SELECT t.code KodeGuru,s.code KodeMapel,c.name NamaKelas,a.jp_week JPMinggu,a.max_jp_day MaksJPHari FROM assignments a JOIN teachers t ON t.id=a.teacher_id JOIN subjects s ON s.id=a.subject_id JOIN classes c ON c.id=a.class_id ORDER BY t.code,c.name`).all() as any[];
  else if (type === "unavailability") rows = db.prepare(`SELECT CASE entity_type WHEN 'teacher' THEN 'guru' ELSE 'kelas' END Tipe, COALESCE(t.code,c.name) KodeAtauNama, day Hari, period JP FROM unavailability u LEFT JOIN teachers t ON entity_type='teacher' AND t.id=entity_id LEFT JOIN classes c ON entity_type='class' AND c.id=entity_id`).all() as any[];
  else return NextResponse.json({ ok: false, error: "Tipe tidak dikenal." }, { status: 404 });
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), SHEETS[type as keyof typeof SHEETS]?.sheet || type);
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buf, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${type}.xlsx"` } });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ type: string }> }) {
  const u = await currentUser(); if (!u || u.role !== "admin") return NextResponse.json({ ok: false, error: "Khusus Superadmin." }, { status: 403 });
  const { type } = await ctx.params;
  const isAll = type === "import-all";
  if (!isAll && type !== "import" && !IMPORTERS[type]) return NextResponse.json({ ok: false, error: "Import hanya untuk guru/mapel/kelas/penugasan/ketidaktersediaan atau import-all." }, { status: 400 });
  const form = await req.formData(); const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ ok: false, error: "File tidak ada. Pilih file .xlsx/.xls/.csv dulu." }, { status: 400 });
  let wb: any;
  try { const XLSX = await import("xlsx"); wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer" }); }
  catch { return NextResponse.json({ ok: false, error: "File tidak dapat dibaca. Gunakan file Excel .xlsx/.xls atau CSV." }, { status: 400 }); }
  const XLSX = await import("xlsx");
  const reports: Report[] = [];
  tx(() => {
    if (isAll || type === "import") {
      const wanted = [["Guru", "teachers"], ["Mapel", "subjects"], ["Kelas", "classes"], ["Penugasan", "assignments"], ["Ketidaktersediaan", "unavailability"]] as const;
      let found = 0;
      for (const [sheetName, key] of wanted) {
        const actual = wb.SheetNames.find((n: string) => norm(n) === norm(sheetName) || norm(n) === norm(key));
        if (!actual) continue; found++;
        reports.push(IMPORTERS[key](XLSX.utils.sheet_to_json(wb.Sheets[actual], { defval: "" })));
      }
      if (!found) reports.push({ ...newReport("(tidak ada)"), errors: ["Tidak ada sheet bernama Guru, Mapel, Kelas, Penugasan, atau Ketidaktersediaan. Unduh template resmi agar nama sheet & kolomnya sesuai."] });
    } else {
      const name = wb.SheetNames[0];
      reports.push(IMPORTERS[type](XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: "" })));
    }
  });
  const totalBaru = reports.reduce((a, r) => a + r.baru, 0), totalUpdate = reports.reduce((a, r) => a + r.diperbarui, 0), totalDilewati = reports.reduce((a, r) => a + r.dilewati, 0);
  const detail = reports.map(r => `${r.sheet}: ${r.baru} baru, ${r.diperbarui} diperbarui, ${r.dilewati} dilewati`).join(" • ");
  return NextResponse.json({ ok: true, reports, imported: totalBaru + totalUpdate,
    message: totalBaru + totalUpdate ? `Import selesai — ${detail}.` : `Tidak ada data yang masuk. ${detail}. Periksa laporan kesalahan di bawah dan pastikan memakai template resmi.`,
    errors: reports.flatMap(r => r.errors.map(e => `${r.sheet} — ${e}`)).slice(0, 20) });
}
