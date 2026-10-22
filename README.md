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
  CP = OR-Tools CP-SAT (library solver Google) lewat proses Python: batasan keras adalah constraint,
  hasil FEASIBLE/OPTIMAL pasti 0 hard violation, INFEASIBLE berarti data/aturan terbukti mustahil.
  Syarat: Python 3 + `pip install ortools` (atau `pip install -r requirements.txt`).
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
CP-SAT OR-Tools (library, lihat di bawah), GA Memetic delta (populasi 16, elit 5, 10 anak, mutasi, local search delta), dan Tabu Search delta
(60 calon/iterasi, tabu 12 iterasi, aspirasi), parameter pengguna vs parameter internal, cara membandingkan
model, penyebab solver tidak menemukan hasil, batasan sistem yang belum dimodelkan, serta glosarium.
Isinya diselaraskan dengan parameter nyata di `lib/solver.ts`, bukan teori umum semata.

## Profil & Kelola Akun
Menu **Profil Saya** (`/profil`) tersedia untuk semua pengguna: ringkasan akun dan guru terhubung,
statistik penugasan/JP/pengajuan, ubah nama tampilan & username, dan ganti password (password lama
wajib benar). Khusus Superadmin, halaman yang sama memiliki **Kelola Akun Pengguna (CRUD Profil)**:
buat akun, edit nama/username/peran, kaitkan akun ke data guru, reset password, dan hapus akun.
Akun sendiri serta Superadmin terakhir dilindungi dari penghapusan/penurunan peran.

## Format Import Excel (satu file, banyak sheet)
Unduh template resmi dari Data Master (atau file `template-import-jadwal.xlsx`): satu workbook berisi sheet
**Petunjuk, Guru, Mapel, Kelas, Penugasan, Ketidaktersediaan**. Isi mulai baris ke-2, jangan mengubah nama sheet
dan judul kolom. Kolom Penugasan memakai **KodeGuru + KodeMapel + NamaKelas** (bukan ID). Import memproses
berurutan Guru -> Mapel -> Kelas -> Penugasan -> Ketidaktersediaan, memperbarui data berkode sama (tidak dobel),
dan selalu menampilkan laporan per sheet: jumlah baru/diperbarui/dilewati beserta alasan per baris yang dilewati.
Export per bagian sekarang memakai judul kolom format yang sama, sehingga file export dapat diedit lalu
diimpor kembali. Tombol import per-tab tetap ada untuk file satu sheet.

Hapus Data Master memakai modal konfirmasi sendiri (bukan `confirm()` browser). Bila data masih dipakai,
penghapusan pertama ditahan (409) dan menampilkan rinciannya — jumlah penugasan, kartu jadwal,
ketidaktersediaan, akun terhubung — lalu Superadmin dapat memilih **Hapus Beserta Relasinya**;
relasi dibersihkan dalam satu transaksi (penugasan/kartu jadwal/ketidaktersediaan terkait dan pengajuan
pending-nya; akun pengguna hanya dilepas kaitannya, tidak dihapus). Setelah menghapus data yang memiliki
kartu jadwal, jalankan Solver untuk men-generate ulang.

## Kecepatan Solver (Mesin Delta)
GA & Tabu memakai **penilaian delta**: cacah guru/kelas/hari dipelihara dalam array, dan menilai satu langkah
hanya menghitung slot/hari yang berubah — bukan menilai ulang seluruh jadwal untuk setiap calon (cara lama).
Hasil akhir tetap diverifikasi evaluator penuh sebelum diterapkan. Pada data bawaan (24 penugasan, 72 JP),
Adu Model terukur sekitar **0,1 detik total** (CP ±0,01 dtk, GA ±0,07-0,11 dtk, Tabu ±0,03 dtk) dengan
hard=0 pada kelima pengujian; sesudah diterapkan, pelanggaran pola 0 dan bentrok guru/kelas 0.
Karena itu solver tidak memerlukan runtime Go/Python tambahan yang harus dipasang terpisah di tiap komputer.

## Solver Library: OR-Tools CP-SAT (WAJIB untuk hasil pasti)
Model **CP** di menu Solver memakai library beneran — **OR-Tools CP-SAT dari Google** — dijalankan sebagai
proses Python (`solver/cpsat_solver.py`) yang dipanggil aplikasi. Berbeda dengan heuristik (GA/Tabu) dan
backtracking buatan sendiri, CP-SAT memodelkan bentrok guru/kelas, ketidaktersediaan, pola blok 2JP, dan
batas JP harian sebagai *constraint*: hasil FEASIBLE/OPTIMAL dijamin 0 hard violation, dan status
INFEASIBLE adalah bukti matematis bahwa data/aturan mustahil dipenuhi semua (aplikasi menampilkan
diagnosisnya, termasuk pra-cek: total JP guru/kelas > JP tersedia seminggu, unit tanpa slot sah,
total penugasan > batas harian x jumlah hari).

Pasang sekali di komputer yang menjalankan aplikasi:
```
pip install ortools
```
(atau `pip install -r requirements.txt`). Butuh Python 3 pada PATH — di Windows pasang dari python.org
dan centang "Add python.exe to PATH"; bila perintah Python Anda khusus, set variabel lingkungan
`CPSAT_PYTHON`. Tanpa itu, model CP menampilkan pesan "belum tersedia" dan hanya GA/Tabu yang berjalan.
CP-SAT mencari jadwal layak lebih dulu lalu soft-nya dipoles local search delta ±1,5 detik, sehingga
tidak menghabiskan timeout untuk membuktikan optimum. Terukur: data bawaan ±0,6 detik; uji sintetis
132 unit/44 kelas ±1,1 detik — keduanya hard 0.

## Drag & Drop Instan (tanpa cek server saat mulai menyeret)
Pewarnaan hijau/merah/ungu saat kartu mulai diseret kini dihitung **lokal di browser** dari data papan yang
sudah dimuat: konteks aturan (ketidaktersediaan + Maks JP/Hari guru & penugasan) dikirim sekali oleh
`/api/board`, lalu Board mengevaluasi semua slot & kandidat tukar secara sinkron — tanpa request jaringan,
jadi warna muncul seketika. Hasil lokal ini sudah diverifikasi identik dengan analisis server untuk kartu
tunggal, tukar, maupun blok 2JP. Server tetap menjadi otoritas akhir: saat kartu dilepas (drop), endpoint
geser memvalidasi ulang seluruh jadwal dalam transaksi sebelum menyimpan/mengajukan.

Pewarnaan dibaca/dihitung lokal tepat saat kartu diangkat, disimpan dengan `useState`
(`slotMap`/`swapSet`), dan dirender React melalui `cellClass`.

Warna kartu di papan mengikuti **guru**, bukan mapel: warnanya custom per guru,
sehingga satu guru yang memegang dua mapel akan berwarna sama di semua kartunya. Kartu milik pengguna
yang sedang login (akun terhubung ke guru tersebut) diberi penanda kontras — ring
hitam — dan pada legenda guru ditandai "⭐ Saya".

## Warna Guru Custom (HEX)
Setiap guru punya `color_hex` (#RRGGBB) yang tersimpan di tabel teachers. Superadmin mengaturnya di
Data Master (pemilih warna + ketik HEX + tombol Acak), guru mengaturnya sendiri di Profil bila akunnya
terhubung ke data guru, dan kolom opsional `WarnaHEX` tersedia pada import/export sheet Guru.
Warna tidak boleh sama dengan guru lain dan tidak boleh terlalu mirip (jarak RGB minimum 110 dari
maksimum 441); tombol Acak memilih kandidat dengan jarak terjauh dari warna yang sudah dipakai.
Warna teks kartu di papan dihitung otomatis (hitam/putih berdasarkan kontras WCAG) agar selalu terbaca.
Database lama otomatis mendapat kolom ini dan warna awal berjarak jauh saat pertama dijalankan.
Popup pemilih warna (Profil & Data Master) menyediakan rekomendasi warna aman yang dapat digeser/diklik,
slider Hue/Saturation/Lightness dengan preview kartu langsung, input HEX dan pemilih warna perangkat,
serta status kemiripan terhadap guru terdekat. Tombol pakai warna dinonaktifkan selama warna persis sama
atau jaraknya di bawah minimum; rekomendasi yang ditampilkan hanya yang jaraknya aman (>= 15).

Algoritma warna: kandidat dibangkitkan dengan urutan Halton (low-discrepancy) lalu dipilih memakai
farthest-point sampling/maximin di ruang CIELAB — jaraknya Delta E CIEDE2000 (persepsi manusia), dengan
minimum 15. Ini prinsip yang sama dengan library Python `distinctipy`; implementasinya di
TypeScript agar tidak menambah runtime/dependensi Python di komputer pengguna.
Saat kartu diangkat, papan menampilkan indikator state "Mengecek slot aman..." lalu petunjuk warna.
Kartu 1JP tidak dapat menukar/memecah kartu yang merupakan blok 2JP: kandidat tukar lokal maupun
server menyingkirkan anggota blok, drop di atas blok ditolak dengan alasan, dan endpoint geser serta
persetujuan pengajuan menolak tukar yang melibatkan blok 2JP (blok hanya bisa digeser sebagai blok utuh).

## Export Jadwal (format cetak)
Tombol Export Jadwal menghasilkan workbook bergaya spreadsheet referensi: satu sheet per tingkat
kelas (KELAS 7, KELAS 8, dst.; awalan Romawi seperti VII digabung ke tingkat yang sama), judul
"JADWAL MATA PELAJARAN <Nama Sekolah dari menu Aturan>", subjudul hijau per tingkat, kolom
HARI | JAM | KELAS x - A..., sesi digabung per 2 JP dengan baris nama mapel tebal di atas nama
guru, baris ISTIRAHAT di antara sesi, pemisah hijau antarhari, font Times New Roman ber-border,
dan page setup landscape A3 fit-to-width. Dua kartu 1JP berbeda dalam satu sesi ditulis per baris sebagai
"NAMA MAPEL - Nama Guru" (baris atas JP pertama, baris bawah JP kedua; nama mapel ditebalkan). Dibangun dengan ExcelJS (dependensi baru) karena SheetJS komunitas
tidak menulis style.

## Mengatasi "EADDRINUSE: address already in use 0.0.0.0:3000"
Artinya port 3000 sudah dipakai server yang masih berjalan (bukan kerusakan aplikasi).
`npm run start` kini otomatis beralih ke port kosong berikutnya (3001, 3002, ...) dan mencetak
alamat yang harus dibuka. Bila ingin tetap di 3000, tutup terminal server lama (Ctrl+C) atau
matikan prosesnya — Windows: `npx kill-port 3000`; macOS/Linux: `lsof -ti:3000 | xargs kill`.
Nama mapel di export ditulis lengkap, kecuali yang kepanjangan (>18 huruf) disingkat memakai
kode mapelnya (Ilmu Pengetahuan Sosial -> IPS, Ilmu Pengetahuan Alam -> IPA,
Pendidikan Jasmani, Olahraga, dan Kesehatan -> PJOK).
Flowchart di Knowledge Base dirender memakai library Mermaid (layout otomatis dagre,
dibundel lokal via komponen components/MermaidDiagram.tsx; definisi diagram berupa teks
FLOW_MAIN/FLOW_CPSAT/FLOW_GA/FLOW_TABU di app/knowledge/page.tsx).
