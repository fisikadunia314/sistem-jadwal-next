# Panduan Demo Kelompok — Sistem Jadwal Otomatis

**Format:** 15 menit · **Penilaian:** kelompok (satu nilai) · **Anggota:** A, B, C

Karena nilainya kelompok, yang dinilai bukan "siapa paling banyak ngoding", tapi:
1. **Hasilnya jalan** saat didemokan,
2. **Semua orang paham** apa yang ditampilkan (bukan satu orang bicara, dua orang jadi patung),
3. **Beban kerja terbagi** dan bisa dibuktikan.

---

## 1. Pembagian tugas

| | **A — Data & Output** | **B — Solver** | **C — Pengalaman Pengguna** |
|---|---|---|---|
| **Judul segmen** | "Dari data mentah jadi jadwal" | "Jadwal yang bisa dipertanggungjawabkan" | "Jadwal dipakai sehari-hari" |
| **Kepemilikan kode** | `lib/db.ts`, seed, `app/api/master/*`, `app/api/excel/*`, `lib/export-jadwal.ts`, `app/master`, `app/aturan` | `lib/solver.ts`, `lib/cpsat.ts`, `solver/cpsat_solver.py`, `app/api/solver`, `app/solver`, bagian solver di Knowledge Base | `lib/auth.ts`, `components/Board.tsx`, `TeacherColorPicker`, `app/jadwal`, `app/api/board`, `app/api/requests`, `app/profil` |
| **Fitur yang dibela** | Import Excel multi-sheet, template + laporan baris gagal, CRUD + hapus berantai, pengaturan jam & pola blok, Export Jadwal per tingkat | CP-SAT, preflight mustahil, hard/soft, adu CP-SAT vs GA vs Tabu, verifikasi hard 0 | Login/role, drag-drop hijau/merah/ungu, blok 2JP utuh, Area Cadangan, warna guru ΔE 15, pengajuan & persetujuan |
| **Tanggung jawab tambahan** | Database, backup, rilis ZIP | Kualitas & dokumentasi solver | Koordinator demo + konsistensi UI |
| **Cadangan kalau absen** | C | A | B |

**Aturan bukti kontribusi (dikumpulkan, tidak harus ditampilkan):**
- Commit diberi prefix `[A]` / `[B]` / `[C]`.
- Setiap fitur direview satu orang lain sebelum dianggap selesai.
- Catatan harian singkat: tanggal, fitur, kendala. Cukup 1 baris per hari.

---

## 2. Naskah demo 15 menit

| Waktu | Siapa | Isi |
|---|---|---|
| 0:00–0:45 | **C** | Pembuka: masalah, angka, agenda |
| 0:45–4:15 | **A** | Data → import → aturan → export |
| 4:15–8:15 | **B** | Generate CP-SAT + adu solver + bukti hard 0 |
| 8:15–11:45 | **C** | Papan drag-drop, warna, pengajuan |
| 11:45–13:00 | **A** | Penutup: angka, keterbatasan jujur, rencana |
| 13:00–15:00 | semua | Buffer / tanya jawab awal |

### Pembuka (C, 45 detik)

> "Kami membuat sistem penjadwalan otomatis untuk SMP Daarul Kholidin: 8 guru, 35 mata pelajaran, 44 kelas, total 72 jam pelajaran per minggu. Kalau disusun manual, satu perubahan bisa merusak semua. Kami pakai OR-Tools CP-SAT supaya jadwalnya dijamin tidak bentrok — bukan hasil coba-coba. Alurnya: data masuk, solver menyusun, lalu guru memakainya. Dimulai dari A."

### Segmen A (3,5 menit)

| Detik | Aksi | Kalimat kunci |
|---|---|---|
| 0:00 | (opsional) Buka `/reset` → **Kosongkan Jadwal Saja** | "Supaya adil, papan saya kosongkan dulu — jadwalnya akan dibuat ulang dari nol di depan Anda." |
| 0:20 | Buka `/aturan` | "Nama sekolah dipakai sebagai judul export, pola blok 2JP aktif, dan jam Jumat hanya JP 1–4 dan 7–8 — JP 5–6 ibadah." |
| 0:35 | `/master` → **Import Excel** → unduh template | "Satu file, lima sheet: Guru, Mapel, Kelas, Penugasan, Ketidaktersediaan. Ada sheet Petunjuk." |
| 1:00 | Import file **yang sengaja salah satu barisnya** | "Baris 12 dilewati karena kode mapel tidak dikenal. Import tidak menelan error diam-diam." |
| 1:45 | Data Master: ubah warna guru, tunjukkan urutan spektrum | "Warna tersimpan sebagai HEX di data guru, dipakai konsisten di papan dan export." |
| 2:20 | Klik hapus guru yang masih dipakai | "Muncul dependensi: guru ini terikat 4 penugasan dan 12 jadwal. Bisa dibatalkan, atau dihapus beserta relasinya." |
| 2:50 | **Export Jadwal** → buka file Excel | "Satu sheet per tingkat, kolom HARI–JAM lalu kelas. ISTIRAHAT dari jam asli. Dua pelajaran 1JP dalam satu sesi jadi dua baris. Nama lebih dari 18 huruf disingkat kode — misalnya PJOK." |

**Tekankan:** tombol hapus tidak pakai `confirm()` browser, dan export-nya sudah dicocokkan dengan format spreadsheet sekolah.

### Segmen B (4 menit)

| Detik | Aksi | Kalimat kunci |
|---|---|---|
| 0:00 | Buka `/solver` | "Masalahnya bukan sekadar 'cari yang tidak bentrok' — ada batas jam, ketidaktersediaan guru, dan pola blok." |
| 0:30 | Klik **Generate CP-SAT** | "Hard 0 dalam sekitar 1 detik. Hard 0 artinya tidak ada satu pun pelanggaran aturan wajib." |
| 1:15 | Buka tabel **Adu Solver** | "CP-SAT vs GA vs Tabu, metriknya hard, soft, waktu." |
| 2:00 | Sorot baris CP-SAT | "CP-SAT langsung membuktikan kelayakan. GA dan Tabu sifatnya menebak dan memperbaiki; di data ini baru hard 0 setelah dibantu. Itu sebabnya solver utama CP-SAT, GA/Tabu hanya pembanding." |
| 2:40 | Tunjukkan verifikasi independen | "Saya cek ulang di luar laporan solver: pola 2JP cocok, tidak ada guru bentrok, tidak ada kelas bentrok — semuanya 0." |
| 3:20 | (opsional, kalau waktu cukup) data mustahil | "Kalau JP guru saya isi 99, sistem menolak sebelum solver jalan: 111 JP melebihi 38 slot seminggu." |

**Satu keputusan teknis yang harus disebut B:** waktu dipakai *feasibility-first* lalu polish soft 1,5 detik — bukan mengejar nilai soft optimal, karena mengejar optimum membuat solver menghabiskan seluruh timeout untuk membuktikan sesuatu yang tidak perlu.

### Segmen C (3,5 menit)

| Detik | Aksi | Kalimat kunci |
|---|---|---|
| 0:00 | Login sebagai guru (akun contoh), buka `/jadwal` | "Guru hanya melihat jadwalnya, tidak bisa mengacak jadwal sekolah." |
| 0:30 | Angkat kartu | "Begitu kartu diangkat, sistem langsung menghitung lokal — muncul 'Mengecek slot aman…' tanpa request tambahan, jadi tidak ada lag." |
| 1:00 | Sorot hijau / merah / ungu | "Hijau aman, merah tidak aman disertai alasannya, ungu tukar yang valid." |
| 1:40 | Coba pindahkan 1JP ke blok 2JP | "Ditolak: blok 2JP harus utuh. Aturan ini sama di UI, di server, dan di persetujuan." |
| 2:00 | Geser blok ke **Area Cadangan** lalu pasang lagi | "Blok tetap utuh walau diparkir." |
| 2:25 | Popup warna guru | "Rekomendasi otomatis, bisa digeser, status kemiripan pakai Delta E. Di bawah 15 ditolak supaya tidak ada dua guru dengan warna nyaris sama." |
| 2:50 | Ajukan tukar → login admin → setujui | "Guru mengajukan dulu dengan prediksi dampak; jadwal baru berubah setelah Superadmin menyetujui dan validasi ulang lolos." |

### Penutup (A, 75 detik)

> "Ringkasnya: 44 kelas, 72 jam pelajaran, tersusun dengan hard 0 dalam sekitar 1 detik, dan hasilnya dipakai lewat papan yang memandu aman-tidaknya pemindahan.
> Kami jujur soal batasnya: `max_jp_week` per guru masih tersimpan sebagai data dan belum ditegakkan solver, dan kelas pecah/gabung (satu kelas dibagi dua kelompok paralel) baru dirancang, belum dibangun.
> Langkah berikutnya justru itu: model kelompok/peserta, supaya dua guru bisa mengajar satu kelas di waktu yang sama."

---

## 3. Pembagian agar tidak ada yang "penonton"

- **Operator ≠ narator.** Di segmennya, pemilik modul menggerakkan mouse; satu orang lain membacakan alur. Jadi semua orang kelihatan menguasai layar.
- **Tiap orang wajib menyebut satu keputusan teknis dan satu keterbatasan.** Ini mencegah kesan "cuma satu orang yang paham".
- **Tanya jawab acak.** Dosen sering menunjuk bebas. Sebelum hari-H, tiap orang harus bisa menjawab 2 pertanyaan dari modul orang lain (lihat tabel di bawah).

### Peta pertanyaan → penjawab → jawaban singkat

| Pertanyaan | Penjawab utama | Jawaban inti |
|---|---|---|
| Kenapa pakai CP-SAT, bukan GA? | B | CP-SAT membuktikan kelayakan; GA/Tabu hanya mencari dan bisa macet di pelanggaran. |
| Kenapa SQLite, bukan MySQL? | A | Aplikasi satu sekolah, satu server; SQLite tanpa instalasi, transaksi aman, mudah dibackup. |
| Kalau dua admin mengubah bersamaan? | A | Penulisan diserialisasi dengan transaksi dan `busy_timeout`, jadi tidak ada data setengah jadi. |
| Kenapa warna tidak boleh mirip? | C | Supaya guru terbaca dari warna kartu; ambang ΔE 15 dengan perhitungan CIEDE2000, termasuk beda terang-gelap. |
| Bagaimana kalau jadwal mau diubah tapi bentrok? | C | Server menolak dengan alasan; guru hanya bisa mengajukan, bukan langsung mengubah. |
| Kenapa export dipisah per tingkat? | A | Mengikuti format resmi sekolah: satu lembar per tingkat, siap dicetak A3 landscape. |
| Apa yang belum selesai? | siapa pun | `max_jp_week` belum ditegakkan; kelas pecah/gabung belum dibangun. |

---

## 4. Checklist H-1

- [ ] `data/app.db` dikembalikan ke kondisi demo bersih — cara cepat: menu **🧹 Reset Data → Muat Ulang Data Contoh**.
- [ ] Putuskan apakah jadwal mau dikosongkan dulu (tombol **Kosongkan Jadwal Saja**) agar segmen solver bisa menunjukkan generate dari nol.
- [ ] `npm install` + `npm run build` dijalankan ulang di laptop yang dipakai demo.
- [ ] Python + `pip install -r requirements.txt` terpasang, dan `python3 -c "import ortools"` lolos.
- [ ] File Excel demo siap: satu file benar + satu file dengan baris salah.
- [ ] Akun siap: `admin / admin123` dan akun guru contoh.
- [ ] Coba **tanpa internet** (Mermaid dan font lokal) — kalau tetap jalan, aman dari WiFi kampus.
- [ ] **Rekam video layar 8 menit** sebagai cadangan kalau laptop/server bermasalah.
- [ ] ZIP terbaru tersimpan di dua tempat (flashdisk + cloud).
- [ ] Latihan penuh dengan stopwatch minimal 2 kali; target 13 menit, sisanya buffer.

## 5. Rencana kalau gagal di tengah demo

| Kejadian | Tindakan |
|---|---|
| Server tidak mau naik | `npm run start` otomatis pindah port; lihat URL baru di terminal |
| Generate CP-SAT error "Python tidak ditemukan" | Sebutkan penyebabnya, gunakan video cadangan untuk segmen itu |
| Data berubah karena salah klik | Kembalikan dari backup `app.db` yang sudah disiapkan |
| Proyektor memotong layar | Pakai zoom tinggi baris papan (fitur bawaan), bukan mengubah lebar |

---

## 6. Rencana kerja 3 minggu

| Minggu | A | B | C |
|---|---|---|---|
| 1 | Skema DB, seed, CRUD Data Master | CP-SAT + bridge + preflight | Auth, shell, papan baca-saja |
| 2 | Import/export Excel, Aturan | Adu solver, metrik, Knowledge Base solver | Drag-drop, warna guru, pengajuan |
| 3 | Integrasi & rilis ZIP | Verifikasi hard 0 independen | Polish UI + latihan demo |

**Definisi selesai:** fitur dianggap selesai kalau lolos build, lolos uji manual sesuai acceptance criteria, dan direview satu orang lain.
