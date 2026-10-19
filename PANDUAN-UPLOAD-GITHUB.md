# Panduan Upload Sistem Jadwal ke GitHub

Panduan ini dibuat untuk proyek **sistem-jadwal-next** (Next.js + TypeScript + Tailwind).
Ada dua cara: **GitHub Desktop (paling mudah, tanpa mengetik perintah)** dan **Git lewat terminal**.
Pilih salah satu saja.

> **Saran penting:** buat repository sebagai **Private** dulu. Proyek ini berisi data awal sekolah
> dan akun bawaan (`admin/admin123`) untuk pengujian. Jangan jadikan publik sebelum akun &
> data contoh diganti.

---

## Persiapan Sekali Saja

1. Buat akun / masuk ke <https://github.com>.
2. Pastikan di komputer sudah ada:
   - **Node.js 22 atau lebih baru** — cek dengan `node -v`
   - Untuk Cara A: aplikasi **GitHub Desktop** — unduh di <https://desktop.github.com>
   - Untuk Cara B: **Git** — unduh di <https://git-scm.com/download/win>, lalu cek dengan `git --version`

File `.gitignore` sudah disiapkan di proyek ini. Artinya folder berikut **tidak akan ter-upload**
(dan memang tidak perlu):
- `node_modules/` — sangat besar, dibuat ulang dengan `npm install`
- `.next/` — hasil build, dibuat ulang dengan `npm run build`
- `data/app.db` — database lokal Anda. Tenang: data awal akan dibuat ulang dari
  `data/seed.json` saat aplikasi pertama kali dijalankan di komputer lain.

yang **akan** ter-upload: semua kode sumber (`app/`, `components/`, `lib/`), `data/seed.json`,
`package.json`, `package-lock.json`, konfigurasi, README, dan panduan ini.

---

## Cara A — GitHub Desktop (disarankan bila belum terbiasa Git)

### 1. Buat repository kosong di GitHub
1. Di github.com klik tombol **+** (kanan atas) → **New repository**.
2. Isi **Repository name**, misalnya `sistem-jadwal-sekolah`.
3. Pilih **Private**.
4. **Jangan** centang "Add a README file", "Add .gitignore", atau license
   (proyek lokal Anda sudah punya file sendiri; repo harus kosong agar tidak bentrok).
5. Klik **Create repository**. Biarkan dulu halaman repo-nya.

### 2. Hubungkan folder proyek
1. Buka **GitHub Desktop**, masuk dengan akun GitHub Anda (File → Options → Accounts bila belum).
2. Klik **File → Add local repository…**
3. Pilih folder proyek, contoh: `D:\Download\Algorithm_Design\sistem-jadwal-next`
4. Bila muncul tulisan *"This directory does not appear to be a Git repository"*,
   klik **create a repository** pada tautan di pesan itu, lalu klik **Create repository**.
5. GitHub Desktop akan menampilkan daftar file yang akan di-commit (seharusnya **tidak ada**
   folder `node_modules` di daftar — bila ada, berarti `.gitignore` belum terbaca;
   tutup dan buka lagi GitHub Desktop).

### 3. Commit & publish
1. Di kiri bawah, isi kotak ringkasan, misalnya: `Versi awal sistem jadwal Next.js`
2. Klik **Commit to main**.
3. Klik tombol **Publish repository** di bagian atas.
4. Pastikan nama repo sama, opsi **Keep this code private** tercentang, klik **Publish repository**.
5. Selesai. Klik **View on GitHub** untuk melihat hasilnya di browser.

### 4. Setiap kali selesai mengubah kode (update berikutnya)
1. Buka GitHub Desktop → repository Anda.
2. Centang file yang berubah, isi ringkasan perubahan, klik **Commit to main**.
3. Klik **Push origin**.
Tidak perlu membuat repository baru lagi.

---

## Cara B — Git Lewat Terminal (CMD / PowerShell / Git Bash)

### 1. Buat repository kosong di GitHub
Sama seperti Cara A langkah 1: buat repo **Private**, **tanpa** README/.gitignore/license.
Setelah dibuat, GitHub menampilkan alamat seperti:

```
https://github.com/USERNAME/sistem-jadwal-sekolah.git
```

### 2. Upload dari folder proyek
Buka terminal **di dalam folder proyek** (di File Explorer: klik kanan folder → *Open in Terminal*),
lalu jalankan perintah ini satu per satu:

```bat
cd D:\Download\Algorithm_Design\sistem-jadwal-next

git init
git add .
git status
git commit -m "Versi awal sistem jadwal Next.js"
git branch -M main
git remote add origin https://github.com/USERNAME/sistem-jadwal-sekolah.git
git push -u origin main
```

Ganti `USERNAME` dan nama repo dengan milik Anda.

Penjelasan singkat:
- `git init` — menjadikan folder ini repository Git lokal (cukup sekali).
- `git add .` — memilih semua file (yang tidak diabaikan `.gitignore`) untuk disimpan.
- `git status` — memeriksa daftar file; pastikan `node_modules` **tidak** muncul.
- `git commit -m "..."` — menyimpan versi dengan catatan.
- `git remote add origin ...` — menghubungkan folder lokal ke repository GitHub.
- `git push -u origin main` — meng-upload. `-u` hanya perlu pada push pertama.

### 3. Soal login saat push
GitHub **tidak menerima password akun** untuk push. Biasanya yang terjadi salah satu ini:
- Muncul jendela browser untuk masuk GitHub → masuk seperti biasa (paling mudah, lewat Git Credential Manager).
- Diminta token → buat di GitHub: **Settings → Developer settings → Personal access tokens →
  Tokens (classic) → Generate new token**, centang scope **repo**, lalu tempel token itu
  sebagai "password" di terminal. Token ini rahasia, jangan dibagikan.

### 4. Update berikutnya (setelah kode berubah)
Cukup tiga perintah ini, dari folder proyek:

```bat
git add .
git commit -m "Tulis perubahan Anda di sini"
git push
```

Contoh pesan commit yang baik: `Tambah pola blok 2JP di solver`,
`Perbaiki drag blok yang terlihat misah`, `Tambah knowledge base algoritma`.

### 5. Bila `git push` ditolak (rejected / non-fast-forward)
Artinya repo GitHub sudah punya isi (misalnya terlanjur membuat README saat membuat repo).
Ambil dulu isi GitHub, gabungkan, baru push:

```bat
git pull origin main --allow-unrelated-histories
git push
```

Bila setelah pull muncul konflik dan Anda tidak yakin, **jangan** memakai perintah
`git push --force`. Minta bantuan / tanyakan dulu — force dapat menimpa isi repository.

---

## Cara Menjalankan Proyek Hasil Clone (di komputer lain)

```bat
git clone https://github.com/USERNAME/sistem-jadwal-sekolah.git
cd sistem-jadwal-sekolah
npm install
npm run build
npm run start
```

Buka <http://localhost:3000>. Database awal otomatis dibuat dari `data/seed.json`.
Login pengujian: Superadmin `admin` / `admin123`, pegawai `Budi Santoso` / `guru123`.

> Karena `data/app.db` tidak di-upload, jadwal & perubahan yang Anda buat di komputer lama
> **tidak ikut pindah** lewat GitHub. GitHub di sini untuk menyimpan **kode**, bukan data berjalan.
> Bila ingin memindahkan data juga, salin file `data/app.db` secara manual (di luar Git),
> atau export data penting ke Excel dari aplikasi.

---

## Daftar Periksa Sebelum Push

- [ ] Repository diset **Private**
- [ ] `git status` tidak menampilkan `node_modules/`, `.next/`, atau `data/app.db`
- [ ] Tidak ada password/token asli yang tertulis di kode (akun bawaan hanya untuk lokal)
- [ ] `npm run build` berhasil di komputer Anda
- [ ] Pesan commit menjelaskan perubahan dengan jelas

## Masalah yang Sering Terjadi

| Gejala | Penyebab & cara beres |
|---|---|
| Upload sangat lama / ribuan file | `node_modules` ikut ter-add. Pastikan `.gitignore` ada di folder proyek **sebelum** `git add .`. Bila sudah terlanjur commit, jalankan `git rm -r --cached node_modules` lalu commit lagi. |
| `Authentication failed` | Password akun tidak diterima Git. Masuk lewat jendela browser (Credential Manager) atau pakai Personal Access Token (Cara B langkah 3). |
| `remote origin already exists` | Remote sudah pernah ditambahkan. Lihat dengan `git remote -v`; perbaiki alamat dengan `git remote set-url origin ALAMAT_BARU`. |
| `failed to push some refs` / rejected | Ikuti Cara B langkah 5 (pull dulu), jangan force. |
| Repo berisi file aneh dari komputer | Tambahkan polanya ke `.gitignore`, lalu `git rm --cached NAMA_FILE` dan commit. |
