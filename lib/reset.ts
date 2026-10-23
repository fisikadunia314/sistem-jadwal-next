// Reset / bersihkan data untuk kebutuhan demo.
//
// Semua penghapusan berjalan dalam satu transaksi: kalau ada langkah gagal,
// tidak ada kondisi "setengah terhapus" yang bikin papan error.
//
// Catatan: tabel di proyek ini tidak memakai foreign key, jadi urutan hapus
// cukup dari anak ke induk. Akun (users) sengaja dipertahankan kecuali pada
// mode "total", supaya Superadmin yang sedang login tidak ikut terhapus.
import db, { tx, hashPassword, isiWarnaGuru } from "@/lib/db";
import seed from "@/data/seed.json";

export type Scope = "jadwal" | "penugasan" | "master" | "total" | "seed";

export const SCOPES: Record<Scope, { label: string; kata: string; ringkas: string }> = {
  jadwal: {
    label: "Kosongkan Jadwal Saja",
    kata: "HAPUS",
    ringkas: "Kartu jadwal dihapus; guru, mapel, kelas, dan penugasan tetap utuh.",
  },
  penugasan: {
    label: "Kosongkan Jadwal + Penugasan",
    kata: "HAPUS",
    ringkas: "Penugasan (guru × mapel × kelas × JP) dan jadwal dihapus; data master tetap.",
  },
  master: {
    label: "Kosongkan Semua Data Master",
    kata: "HAPUS",
    ringkas: "Guru, mapel, kelas, penugasan, ketersediaan, dan jadwal dihapus. Akun tetap, keterkaitan akun ke guru dilepas.",
  },
  total: {
    label: "Reset Total (Data + Akun Pegawai)",
    kata: "HAPUS",
    ringkas: "Semua data dan semua akun pegawai dihapus. Hanya akun Superadmin yang sedang login yang dipertahankan.",
  },
  seed: {
    label: "Muat Ulang Data Contoh",
    kata: "SEED",
    ringkas: "Data dikembalikan ke kondisi awal: 8 guru, 35 mapel, 47 kelas, 24 penugasan, 72 jadwal, plus akun contoh.",
  },
};

const TABLES = ["teachers", "subjects", "classes", "assignments", "unavailability", "entries"] as const;
type Counts = Record<string, number>;

export function ringkasan(): Counts {
  const c: Counts = {};
  for (const t of TABLES) c[t] = (db.prepare(`SELECT COUNT(*) n FROM ${t}`).get() as any).n;
  c.users = (db.prepare("SELECT COUNT(*) n FROM users").get() as any).n;
  c.pending = (db.prepare("SELECT COUNT(*) n FROM move_requests WHERE status='pending'").get() as any).n;
  c.runs = (db.prepare("SELECT COUNT(*) n FROM runs").get() as any).n;
  return c;
}

function hapusJadwal() {
  db.prepare("DELETE FROM move_requests").run(); // pengajuan menunjuk entry yang akan hilang
  db.prepare("DELETE FROM entries").run();
  db.prepare("DELETE FROM sqlite_sequence WHERE name='move_requests'").run();
}

function hapusPenugasan() {
  hapusJadwal();
  db.prepare("DELETE FROM assignments").run();
}

function hapusMaster() {
  hapusPenugasan();
  db.prepare("DELETE FROM unavailability").run();
  db.prepare("DELETE FROM classes").run();
  db.prepare("DELETE FROM subjects").run();
  db.prepare("DELETE FROM teachers").run();
  db.prepare("UPDATE users SET teacher_id=NULL").run(); // akun tetap, kaitan guru dilepas
}

export function resetData(scope: Scope, userId: number): { ok: true; message: string; counts: Counts } {
  tx(() => {
    if (scope === "jadwal") hapusJadwal();
    else if (scope === "penugasan") hapusPenugasan();
    else if (scope === "master") hapusMaster();
    else if (scope === "total") {
      hapusMaster();
      db.prepare("DELETE FROM runs").run();
      db.prepare("DELETE FROM users WHERE id <> ?").run(userId);
      db.prepare("DELETE FROM sqlite_sequence WHERE name='runs'").run();
    } else if (scope === "seed") {
      hapusMaster();
      db.prepare("DELETE FROM runs").run();
      db.prepare("DELETE FROM sqlite_sequence WHERE name='runs'").run();

      const it = db.prepare("INSERT INTO teachers(id,code,name,max_jp_day,max_jp_week,color_hex) VALUES(?,?,?,?,?,NULL)");
      (seed.teachers as any[]).forEach(t => it.run(t.id, t.code, t.name, t.max_jp_day ?? 0, t.max_jp_week ?? 0));
      const is = db.prepare("INSERT INTO subjects(id,code,name,prefer_pagi) VALUES(?,?,?,?)");
      (seed.subjects as any[]).forEach(s => is.run(s.id, s.code, s.name, s.prefer_pagi ?? 0));
      const ic = db.prepare("INSERT INTO classes(id,name) VALUES(?,?)");
      (seed.classes as any[]).forEach(c => ic.run(c.id, c.name));
      const ia = db.prepare("INSERT INTO assignments(id,teacher_id,subject_id,class_id,jp_week,max_jp_day) VALUES(?,?,?,?,?,?)");
      (seed.assignments as any[]).forEach(a => ia.run(a.id, a.teacher_id, a.subject_id, a.class_id, a.jp_week, a.max_jp_day ?? 2));
      const iu = db.prepare("INSERT INTO unavailability(entity_type,entity_id,day,period) VALUES(?,?,?,?)");
      (seed.unavailability as any[]).forEach(u => iu.run(u.entity_type, u.entity_id, u.day, u.period));
      const ie = db.prepare("INSERT INTO entries(id,assignment_id,day,period) VALUES(?,?,?,?)");
      (seed.entries as any[]).forEach(e => ie.run(e.id, e.assignment_id, e.day, e.period));

      // akun contoh dikembalikan (admin tidak diduplikasi bila sudah ada)
      if (!db.prepare("SELECT id FROM users WHERE username='admin'").get())
        db.prepare("INSERT INTO users(username,password_hash,display_name,role) VALUES(?,?,?,?)")
          .run("admin", hashPassword("admin123"), "Superadmin", "admin");
      const g01: any = db.prepare("SELECT id FROM teachers WHERE code='G01'").get();
      const budi: any = db.prepare("SELECT id FROM users WHERE username='Budi Santoso'").get();
      if (g01 && !budi)
        db.prepare("INSERT INTO users(username,password_hash,display_name,role,teacher_id) VALUES(?,?,?,?,?)")
          .run("Budi Santoso", hashPassword("guru123"), seed.teachers.find((t: any) => t.code === "G01")!.name, "pegawai", g01.id);
      else if (g01 && budi) db.prepare("UPDATE users SET teacher_id=? WHERE id=?").run(g01.id, budi.id);
    }
  });
  // warna guru ikut dipulihkan supaya kartu papan tidak tampil abu-abu setelah reset
  if (scope === "seed") isiWarnaGuru();
  return { ok: true, message: `${SCOPES[scope].label} berhasil dijalankan.`, counts: ringkasan() };
}
