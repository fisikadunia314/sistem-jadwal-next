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
db.exec("PRAGMA journal_mode = WAL");

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

export const DEFAULT_SETTINGS: Record<string, string> = {
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

const count = (db.prepare("SELECT COUNT(*) c FROM teachers").get() as { c: number }).c;
if (count === 0) {
  tx(() => {
    const it = db.prepare("INSERT INTO teachers VALUES(?,?,?,?,?)");
    seed.teachers.forEach((t: any) => it.run(t.id, t.code, t.name, t.max_jp_day, t.max_jp_week));
    const is = db.prepare("INSERT INTO subjects VALUES(?,?,?,?)");
    seed.subjects.forEach((s: any) => is.run(s.id, s.code, s.name, s.prefer_pagi));
    const ic = db.prepare("INSERT INTO classes VALUES(?,?)");
    seed.classes.forEach((c: any) => ic.run(c.id, c.name));
    const ia = db.prepare("INSERT INTO assignments VALUES(?,?,?,?,?,?)");
    seed.assignments.forEach((a: any) => ia.run(a.id, a.teacher_id, a.subject_id, a.class_id, a.jp_week, a.max_jp_day));
    const iu = db.prepare("INSERT INTO unavailability VALUES(?,?,?,?)");
    seed.unavailability.forEach((u: any) => iu.run(u.entity_type, u.entity_id, u.day, u.period));
    const ie = db.prepare("INSERT INTO entries VALUES(?,?,?,?)");
    seed.entries.forEach((e: any) => ie.run(e.id, e.assignment_id, e.day, e.period));
    db.prepare("INSERT INTO users(username,password_hash,display_name,role) VALUES(?,?,?,?)")
      .run("admin", hashPassword("admin123"), "Superadmin", "admin");
    const seedG01 = seed.teachers.find((t: any) => t.code === "G01") as any;
    if (seedG01) db.prepare("INSERT INTO users(username,password_hash,display_name,role,teacher_id) VALUES(?,?,?,?,?)")
      .run("Budi Santoso", hashPassword("guru123"), seedG01.name, "pegawai", seedG01.id);
  });
}
export default db;
