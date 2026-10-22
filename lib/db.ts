// Database memakai SQLite BAWAAN Node.js (node:sqlite) — tanpa modul native
// (better-sqlite3 dihapus karena binding .node-nya tidak portabel antar OS:
// itulah penyebab error "Could not locate the bindings file" di Windows).
// Syarat: Node.js >= 22 (pengguna memakai Node 24 — aman).
import { createRequire } from "module";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import seed from "@/data/seed.json";

const require2 = createRequire(import.meta.url);
const { DatabaseSync } = require2("node:sqlite");

const dir = path.join(process.cwd(), "data");
fs.mkdirSync(dir, { recursive: true });
const db = new DatabaseSync(path.join(dir, "app.db"));
// Saat `next build`, beberapa worker membuka database yang SAMA secara bersamaan.
// busy_timeout membuat koneksi MENUNGGU kunci sampai 15 detik, bukan langsung gagal "database is locked".
db.exec("PRAGMA busy_timeout = 15000");
db.exec("PRAGMA journal_mode = WAL");
function tungguSebentar(ms: number) { try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch {} }
const sedangTerkunci = (e: any) => e?.errcode === 261 || e?.errcode === 5 || /database is locked|SQLITE_BUSY/i.test(String(e?.message || e));

export function tx<T>(fn: () => T): T {
  db.exec("BEGIN");
  try { const r = fn(); db.exec("COMMIT"); return r; }
  catch (e) { try { db.exec("ROLLBACK"); } catch {} throw e; }
}

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pw, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}
export function verifyPassword(pw: string, stored: string): boolean {
  try {
    const [, salt, hash] = stored.split("$");
    const calc = crypto.scryptSync(pw, salt, 64);
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), calc);
  } catch { return false; }
}

db.exec(`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, username TEXT UNIQUE, password_hash TEXT, display_name TEXT, role TEXT DEFAULT 'pegawai', teacher_id INTEGER);
CREATE TABLE IF NOT EXISTS teachers(id INTEGER PRIMARY KEY, code TEXT, name TEXT, max_jp_day INTEGER DEFAULT 0, max_jp_week INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS subjects(id INTEGER PRIMARY KEY, code TEXT, name TEXT, prefer_pagi INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS classes(id INTEGER PRIMARY KEY, name TEXT);
CREATE TABLE IF NOT EXISTS assignments(id INTEGER PRIMARY KEY, teacher_id INTEGER, subject_id INTEGER, class_id INTEGER, jp_week INTEGER, max_jp_day INTEGER DEFAULT 2);
CREATE TABLE IF NOT EXISTS unavailability(entity_type TEXT, entity_id INTEGER, day TEXT, period INTEGER);
CREATE TABLE IF NOT EXISTS entries(id INTEGER PRIMARY KEY, assignment_id INTEGER, day TEXT, period INTEGER);
CREATE TABLE IF NOT EXISTS move_requests(id INTEGER PRIMARY KEY AUTOINCREMENT, entry_id INTEGER, requester_id INTEGER, mode TEXT, target_day TEXT, target_period INTEGER, other_entry_id INTEGER, label TEXT, status TEXT DEFAULT 'pending', created_at TEXT);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS runs(id INTEGER PRIMARY KEY AUTOINCREMENT, model TEXT, hard INTEGER, soft REAL, seconds REAL, note TEXT, created_at TEXT);
`);

// Migrasi database lama: tambahkan warna khusus guru bila kolomnya belum ada.
try {
  const cols = db.prepare("PRAGMA table_info(teachers)").all() as any[];
  if (!cols.some(c => c.name === "color_hex")) db.exec("ALTER TABLE teachers ADD COLUMN color_hex TEXT");
} catch {}

export const DEFAULT_SETTINGS: Record<string, string> = {
  school_name: "", // nama sekolah untuk judul Export Jadwal (kosong = tanpa nama sekolah)
  active_days: "Senin,Selasa,Rabu,Kamis,Jumat",
  solver_timeout: "10",
  w_gap: "3",            // penalti celah kosong guru
  w_sore: "1",           // penalti JP siang untuk mapel prefer pagi
  w_sebar: "2",          // bonus/penalti sebaran mapel per hari
  pola_blok: "1", // 1=generate mengikuti pola blok 2JP (3JP->2+1, 4JP->2+2, dst)
  times_general: JSON.stringify({1:"07:30-08:10",2:"08:10-08:50",3:"09:20-10:05",4:"10:05-10:40",5:"10:40-11:15",6:"11:15-11:50",7:"13:30-14:10",8:"14:10-14:50"}),
  times_friday: JSON.stringify({1:"07:30-08:10",2:"08:10-08:50",3:"09:20-09:55",4:"09:55-10:30",7:"14:00-14:40",8:"14:40-15:20"}),
};
export function getSettings(): Record<string, string> {
  const out = { ...DEFAULT_SETTINGS };
  try { for (const r of db.prepare("SELECT key,value FROM settings").all() as any[]) out[r.key] = r.value; } catch {}
  return out;
}
export function setSetting(key: string, value: string) {
  db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key, value);
}

// Seed per-tabel: tiap tabel dicek SENDIRI. Cara lama hanya mengecek tabel teachers,
// sehingga bila teachers kosong tetapi subjects/classes/dll sudah berisi (mis. data terhapus
// sebagian atau database lama tertimpa setengah), seed menabrak UNIQUE constraint id.
const countOf = (t: string) => (db.prepare(`SELECT COUNT(*) c FROM ${t}`).get() as { c: number }).c;
const perluSeed = () => countOf("teachers") === 0 || countOf("subjects") === 0 || countOf("classes") === 0 || countOf("assignments") === 0 || countOf("entries") === 0
  || !(db.prepare("SELECT id FROM users WHERE username='admin'").get() as any) || !(db.prepare("SELECT id FROM users WHERE username='Budi Santoso'").get() as any);
function jalankanSeed() { tx(() => {
  if (countOf("teachers") === 0) { const it = db.prepare("INSERT INTO teachers(id,code,name,max_jp_day,max_jp_week) VALUES(?,?,?,?,?)");
    seed.teachers.forEach((t: any) => it.run(t.id, t.code, t.name, t.max_jp_day, t.max_jp_week)); }
  if (countOf("subjects") === 0) { const is = db.prepare("INSERT INTO subjects VALUES(?,?,?,?)");
    seed.subjects.forEach((s: any) => is.run(s.id, s.code, s.name, s.prefer_pagi)); }
  if (countOf("classes") === 0) { const ic = db.prepare("INSERT INTO classes VALUES(?,?)");
    seed.classes.forEach((c: any) => ic.run(c.id, c.name)); }
  if (countOf("assignments") === 0) { const ia = db.prepare("INSERT INTO assignments VALUES(?,?,?,?,?,?)");
    seed.assignments.forEach((a: any) => ia.run(a.id, a.teacher_id, a.subject_id, a.class_id, a.jp_week, a.max_jp_day)); }
  if (countOf("unavailability") === 0 && countOf("entries") === 0) { const iu = db.prepare("INSERT INTO unavailability VALUES(?,?,?,?)");
    seed.unavailability.forEach((u: any) => iu.run(u.entity_type, u.entity_id, u.day, u.period)); }
  if (countOf("entries") === 0 && countOf("assignments") > 0) { const ie = db.prepare("INSERT INTO entries VALUES(?,?,?,?)");
    seed.entries.forEach((e: any) => ie.run(e.id, e.assignment_id, e.day, e.period)); }
  const hasUser = (name: string) => !!(db.prepare("SELECT id FROM users WHERE username=?").get(name) as any);
  if (!hasUser("admin")) db.prepare("INSERT INTO users(username,password_hash,display_name,role) VALUES(?,?,?,?)")
    .run("admin", hashPassword("admin123"), "Superadmin", "admin");
  const seedG01 = seed.teachers.find((t: any) => t.code === "G01") as any;
  const g01: any = db.prepare("SELECT id FROM teachers WHERE code='G01'").get();
  if (seedG01 && g01 && !hasUser("Budi Santoso")) db.prepare("INSERT INTO users(username,password_hash,display_name,role,teacher_id) VALUES(?,?,?,?,?)")
    .run("Budi Santoso", hashPassword("guru123"), seedG01.name, "pegawai", g01.id);
}); }
function hslHex(h: number, sat: number, light: number): string {
  const ss = sat / 100, ll = light / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = ss * Math.min(ll, 1 - ll);
  const f = (n: number) => ll - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}
function perluWarnaGuru(): boolean {
  try {
    const rows = db.prepare("SELECT color_hex FROM teachers").all() as any[];
    const seen = new Set<string>();
    for (const r of rows) {
      const v = typeof r.color_hex === "string" ? r.color_hex.trim().toUpperCase() : "";
      if (!/^#[0-9A-F]{6}$/.test(v) || seen.has(v)) return true;
      seen.add(v);
    }
    return false;
  } catch { return false; }
}
function isiWarnaGuru() { tx(() => {
  const rows = db.prepare("SELECT id,color_hex FROM teachers ORDER BY id").all() as any[];
  const used: string[] = [];
  // Jarak persepsi sederhana (Delta E 76 di ruang CIELAB) agar warna awal benar-benar terasa berbeda.
  const lab = (hex: string) => { const ch = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); const X = (0.4124 * ch[0] + 0.3576 * ch[1] + 0.1805 * ch[2]) / 0.95047, Y = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2], Z = (0.0193 * ch[0] + 0.1192 * ch[1] + 0.9505 * ch[2]) / 1.08883; const ft = (t: number) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; const fx = ft(X), fy = ft(Y), fz = ft(Z); return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]; };
  const dist = (a: string, b: string) => { const x = lab(a), y = lab(b); return Math.sqrt((x[0]-y[0])**2 + (x[1]-y[1])**2 + (x[2]-y[2])**2); };
  for (const r of rows) {
    const cur = typeof r.color_hex === "string" ? r.color_hex.trim().toUpperCase() : "";
    if (/^#[0-9A-F]{6}$/.test(cur) && !used.includes(cur)) { used.push(cur); continue; }
    // Maximin: dari ratusan kandidat acak, pilih yang JARAKNYA KE SEMUA warna terpakai paling jauh.
    let best = "", bestMin = -1;
    for (let i = 0; i < 400; i++) {
      const candidate = hslHex(Math.random() * 360, 55 + Math.random() * 35, 42 + Math.random() * 30);
      if (used.includes(candidate)) continue;
      const minD = used.length ? Math.min(...used.map(u => dist(candidate, u))) : 441;
      if (minD > bestMin) { bestMin = minD; best = candidate; }
    }
    used.push(best);
    db.prepare("UPDATE teachers SET color_hex=? WHERE id=?").run(best, r.id);
  }
}); }

// Bila database sudah lengkap, jangan membuka transaksi tulis sama sekali (menghindari kunci saat build paralel).
// Bila masih perlu dilengkapi dan sedang dikunci worker lain, tunggu lalu coba lagi beberapa kali.
for (let percobaan = 1; ; percobaan++) {
  try { if (perluSeed()) jalankanSeed(); if (perluWarnaGuru()) isiWarnaGuru(); break; }
  catch (e) { if (!sedangTerkunci(e) || percobaan >= 40) throw e; tungguSebentar(Math.min(500, 50 * percobaan)); }
}
export default db;
