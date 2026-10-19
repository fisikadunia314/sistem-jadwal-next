# Sistem Jadwal Sekolah — Next.js + TypeScript + Tailwind

Versi Next.js dari sistem jadwal: papan drag & drop realtime dengan penyimpanan terverifikasi.

## Menjalankan (syarat: Node.js >= 22 — dicek dengan `node -v`)
```bash
npm install
npm run build
npm run start
# buka http://localhost:3000
```
Database memakai SQLite bawaan Node (`node:sqlite`) — TANPA modul native,
jadi tidak ada lagi error "Could not locate the bindings file" (penyebabnya dulu:
folder `node_modules` hasil `npm install` di Linux ikut tersalin ke Windows, dan
binary `better_sqlite3.node` tidak cocok antar-OS). Karena itu JANGAN menyalin
`node_modules` antar komputer/sistem operasi — jalankan `npm install` di mesin tujuan.
Bila pernah terlanjur tersalin: hapus folder `node_modules` dan `package-lock.json`,
lalu `npm install` ulang.

## Menu Superadmin tambahan
- **🗂️ Data Master** (`/master`): CRUD guru, mapel, kelas, penugasan + Import/Export Excel per entitas.
  Export jadwal lengkap: tombol di halaman Solver atau `GET /api/excel/jadwal`.
- **🤖 Solver** (`/solver`): adu model CP / GA Memetic / Tabu dengan skor bersama
  `10000*hard + soft` (hard wajib 0), timeout per model, opsi terapkan hasil valid terbaik, riwayat run.
  CP = constraint programming (backtracking + MRV + forward-checking) yang menjamin 0 hard violation
  bila selesai — pengganti CP-SAT OR-Tools yang tidak tersedia sebagai modul Node.
- **⚙️ Aturan** (`/aturan`): hari aktif, jam JP umum & Jumat (JP5-6 ibadah/istirahat, mengajar JP1-4 & 7-8),
  timeout solver, dan bobot soft constraint. Dipakai bersama oleh papan, validasi drag & drop, dan solver.
- **🚫 Ketersediaan** (`/ketersediaan`): klik sel hari×JP untuk menandai tidak tersedia (guru/kelas;
  pegawai hanya miliknya sendiri) — hard constraint bagi solver dan drag & drop.
Login awal: Superadmin `admin`/`admin123`, pegawai contoh `Budi Santoso`/`guru123` (Budi Santoso).
Data awal (guru, mapel, kelas, penugasan, jadwal aktif, ketidaktersediaan) diimpor dari sistem Flask (`data/seed.json`) ke SQLite Next (`data/app.db`) saat pertama kali dijalankan.

## Fitur versi ini
- Login & register (cookie sesi bertanda tangan, password di-hash scrypt).
- Papan jadwal: kolom Hari+JP, baris kelas terdaftar, kartu kecil berwarna unik per mapel + lencana warna guru.
- Drag & drop live: hijau = aman, ungu = tukar aman, merah = tidak bisa + alasan (validasi server TypeScript yang sama untuk analisis & simpan).
- Simpan oleh Superadmin memakai **transaksi SQLite** dan memverifikasi jumlah baris berubah + posisi akhir sebelum menyatakan berhasil; kegagalan dilaporkan apa adanya.
- Drop oleh pegawai menjadi pengajuan; Superadmin menyetujui/menolak di menu Pengajuan dengan kolom prediksi dampak (validasi ulang).
- Area Cadangan/Parkir di bawah papan (tersimpan di localStorage browser) untuk memarkir kartu sementara.
- Jumat: JP mengajar 1-4 & 7-8; JP 5-6 ibadah/istirahat.

## Tampilan (Sidebar + Topbar, DaisyUI)
Layout memakai komponen **DaisyUI** di atas Tailwind (`drawer`, `navbar`, `menu`, `badge`, `btn`, `card`):
- **Desktop (≥1024px):** sidebar selalu terbuka (`lg:drawer-open`) berisi menu + profil + logout.
- **HP & tablet (<1024px):** sidebar tersembunyi dan menjadi *drawer* geser — buka lewat tombol ☰ di topbar,
  otomatis tertutup setelah memilih menu / pindah halaman.
- Topbar sticky menampilkan judul halaman aktif, lencana peran (Superadmin/Pegawai), nama pengguna, dan Logout.
- Menu mengikuti peran: menu Data Master/Solver/Aturan hanya tampil untuk Superadmin.
- Konten responsif: papan jadwal & tabel dapat discroll horizontal di layar kecil, padding dan ukuran judul menyesuaikan breakpoint (`sm`, `lg`).

## Sidebar Mini & Papan Model Blok 2JP
- Di laptop/desktop ada tombol ⏪/⏩ di topbar untuk **mini-kan sidebar** menjadi strip ikon (dengan tooltip); klik lagi untuk melebarkan. Di HP tetap mode drawer.
- Papan memakai **model blok**: 4 kolom blok per hari (turun dari 8 kolom JP), tiap blok = 2 JP berurutan.
  - Dua JP berurutan milik mapel yang sama tampil sebagai **satu kartu gabungan bertanda 2JP** dan **terseret sebagai satu blok** (server memindah 2 baris sekaligus dalam satu transaksi terverifikasi; pegawai menjadi satu pengajuan blok).
  - Mapel 3 JP/minggu tampil sebagai **1 kartu 2JP + 1 kartu 1JP**; kartu 1JP bebas berpasangan dengan 1JP mapel lain di blok yang sama dan diseret per-JP seperti biasa.
  - Antara hari ada pemisah tegas (garis tebal) dan warna kepala hari yang berbeda; Jumat menampilkan blok "🕌 Istirahat" untuk JP5-6.
- Papan memakai lebar penuh satu layar (`table-fixed w-full`) tanpa scroll ke samping; kotak diperkecil (kartu satu baris: kode mapel + kode guru + lencana JP).

## Aturan Pola Blok 2JP (Generate)
Di menu Aturan ada saklar **Pola Blok 2JP** (bawaan aktif). Bila aktif, solver tidak menempatkan per-JP,
melainkan per-UNIT: tiap penugasan dipecah menjadi unit blok 2JP (dua JP berurutan sejajar blok:
JP1-2/JP3-4/JP5-6/JP7-8, Jumat JP1-2/JP3-4/JP7-8) sebanyak `floor(JP/2)` dan satu unit 1JP bila JP ganjil.
Contoh: 3JP -> 2+1, 4JP -> 2+2, 5JP -> 2+2+1. Unit blok hanya boleh menempati JP pertama blok
(CP menempatkan unit blok lebih dulu; GA/Tabu hanya bermutasi di slot kandidat yang sah), sehingga hasil
generate yang valid (hard=0) otomatis mengikuti pola. Hasil terverifikasi: 24 penugasan, 0 pelanggaran pola,
0 bentrok guru/kelas, contoh MTK VII-A 4JP -> 2 blok 2JP dan BIG VII-A 3JP -> 1 blok 2JP + 1x1JP.

## Drag & Drop 1JP di Dalam Blok, Kartu, dan Notifikasi
- Target drop papan adalah **tiap JP di dalam blok** (dua separuh atas/bawah), bukan satu blok utuh:
  kartu 1JP dapat dijatuhkan ke JP kosong pasangannya untuk **berpasangan dalam satu blok/sesi**
  (mis. blok baru terisi 1JP masih menerima 1JP lain). Menjatuhkan kartu tepat di atas kartu 1JP yang
  JP pasangannya kosong juga otomatis **digabung** (mengisi JP kosongnya), bukan ditukar. Tukar hanya
  terjadi bila dijatuhkan pada kartu yang memang pasangan tukar valid (ungu) / blok sudah penuh.
- Kartu di papan hanya menampilkan **kode mapel** + lencana `2JP`/`1JP` (tanpa kode guru; nama guru tetap
  ada di tooltip hover dan legenda warna).
- Notifikasi gaya SweetAlert: toast melayang di **pojok kanan atas**, berwarna menurut status, dan
  **hilang sendiri dalam ±4 detik** (bisa ditutup manual). Konfirmasi terapkan/ajukan memakai modal
  tengah ala SweetAlert, bukan `confirm()` bawaan browser.

Catatan perbaikan drag & drop: ID kartu kini **dikunci saat kartu dijatuhkan** (disimpan di state modal
konfirmasi), bukan dibaca lagi setelah klik tombol modal — karena saat itu status drag sudah dibersihkan
sehingga ID terkirim kosong dan server menjawab "Kartu tidak ditemukan di jadwal aktif".

Tampilan sesi papan: dua JP dalam satu kolom tampil **berdampingan kiri-kanan** (kiri JP ganjil, kanan JP genap),
kepala kolom hanya bertuliskan rentang JP dan jam (tanpa istilah B1/B2). Di toolbar papan ada **zoom vertikal**:
slider tinggi baris 16-56px (tersimpan di browser) dan tombol **Pas 1 Layar** yang menghitung tinggi baris agar
seluruh kelas muat setinggi layar; lebar papan selalu penuh dan tidak berubah oleh zoom ini.

Blok 2JP sebagai satu kesatuan: sesudah drop blok/tukar berhasil, papan **memuat ulang seluruh data papan**
agar kedua kartu pasangan digambar di posisi barunya bersamaan (bukan hanya kartu pertama). Blok 2JP yang
diparkir ke Area Cadangan tersimpan berpasangan dan tampil/terseret keluar lagi sebagai satu kartu "2JP utuh".

## Knowledge Base Algoritma
Menu **Knowledge Base** (`/knowledge`) menjelaskan dalam Bahasa Indonesia yang mudah dipahami: model masalah
unit 2JP/1JP, seluruh batasan keras, batasan halus dan rumus skor `10000 x hard + soft`, cara kerja CP
(backtracking + MRV), GA Memetic (populasi 24, elit 6, 16 anak, mutasi, local search), dan Tabu Search
(60 calon/iterasi, tabu 12 iterasi, aspirasi), parameter pengguna vs parameter internal, cara membandingkan
model, penyebab solver tidak menemukan hasil, batasan sistem yang belum dimodelkan, serta glosarium.
Isinya diselaraskan dengan parameter nyata di `lib/solver.ts`, bukan teori umum semata.

## Profil & Kelola Akun
Menu **Profil Saya** (`/profil`) tersedia untuk semua pengguna: ringkasan akun dan guru terhubung,
statistik penugasan/JP/pengajuan, ubah nama tampilan & username, dan ganti password (password lama
wajib benar). Khusus Superadmin, halaman yang sama memiliki **Kelola Akun Pengguna (CRUD Profil)**:
buat akun, edit nama/username/peran, kaitkan akun ke data guru, reset password, dan hapus akun.
Akun sendiri serta Superadmin terakhir dilindungi dari penghapusan/penurunan peran.
