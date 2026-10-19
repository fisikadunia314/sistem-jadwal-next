import Link from "next/link";

export const metadata = { title: "Knowledge Base — Sistem Jadwal" };

const hardConstraints = [
  ["Bentrok guru", "Seorang guru tidak boleh mengajar di dua kelas pada hari dan JP yang sama.", "Dua kartu guru yang sama jatuh di Selasa JP3.", "Solver + validasi papan"],
  ["Bentrok kelas", "Satu kelas tidak boleh menerima dua pelajaran pada hari dan JP yang sama.", "VII-A menerima MTK dan IPA pada Senin JP1.", "Solver + validasi papan"],
  ["Ketidaktersediaan guru", "Guru tidak ditempatkan pada hari/JP yang ditandai tidak tersedia.", "Guru berhalangan Selasa JP1–JP2, tetapi solver menaruh pelajarannya di sana.", "Menu Ketersediaan"],
  ["Ketidaktersediaan kelas", "Kelas tidak dijadwalkan pada hari/JP yang ditandai tidak tersedia.", "Kelas mengikuti kegiatan luar pada Jumat JP1.", "Menu Ketersediaan"],
  ["JP yang berlaku", "Pelajaran hanya boleh masuk pada JP yang memang tersedia. Jumat hanya JP1–JP4 dan JP7–JP8; JP5–JP6 untuk ibadah & istirahat.", "Pelajaran ditempatkan pada Jumat JP5.", "Struktur bawaan aplikasi"],
  ["Maksimum JP guru per hari", "Jika batas lebih dari 0, total JP guru pada satu hari tidak boleh melebihinya. Nilai 0 berarti belum dibatasi oleh aturan ini.", "Batas 4 JP/hari, tetapi hasil generate memberi 5 JP dalam sehari.", "Data Master → Guru → Maks JP/Hari"],
  ["Maksimum JP penugasan per hari", "Jika batas lebih dari 0, satu kombinasi mapel–kelas–guru tidak boleh melebihi batas JP pada hari yang sama.", "MTK VII-A dibatasi 2 JP/hari, tetapi muncul 3 JP pada Senin.", "Data Master → Penugasan → Maks JP/Hari"],
  ["Jumlah JP terpenuhi persis", "Setiap penugasan harus terbit sebanyak JP/minggu yang diminta—tidak kurang dan tidak lebih.", "Penugasan 3 JP hanya muncul 2 kali dalam jadwal.", "Data Master → Penugasan → JP/Minggu"],
  ["Pola unit 2JP (bila aktif)", "System memecah JP menjadi unit 2JP yang menempati pasangan sejajar (JP1–2, JP3–4, JP5–6, JP7–8) dan sisa 1JP bila ganjil.", "4 JP diterbitkan sebagai 2+1+1 padahal pola aktif mengharuskan 2+2.", "Menu Aturan → Pola Blok 2JP"],
];

const softConstraints = [
  ["Celah kosong guru (w_gap)", "3", "Untuk setiap guru dan hari, JP kosong di antara JP mengajar pertama dan terakhir dihitung sebagai celah. Penalti = total celah × w_gap.", "Guru mengajar JP1 dan JP4 tanpa JP2–JP3: celah 2 → penalti 2 × 3 = 6."],
  ["Mapel prefer-pagi masuk JP siang (w_sore)", "1", "Bila mapel ditandai Prefer Pagi, setiap JP yang terbit pada JP7 atau JP8 dikenai penalti w_sore.", "Mapel prefer-pagi ditempatkan di JP7 dan JP8 → penalti 2 × 1 = 2."],
  ["Mapel menumpuk pada satu hari (w_sebar)", "2", "Untuk setiap penugasan yang muncul lebih dari 2 JP pada satu hari, kelebihan di atas 2 dikalikan w_sebar.", "Satu mapel–kelas muncul 4 JP dalam sehari → (4 − 2) × 2 = 4."],
];

const workflow = [
  ["1. Baca data", "Solver membaca guru, mapel, kelas, penugasan, ketidaktersediaan, hari aktif, pola 2JP, dan bobot soft dari database."],
  ["2. Bentuk unit", "Setiap penugasan diubah menjadi unit yang harus ditempatkan. Bila pola aktif: 3JP menjadi 2+1, 4JP menjadi 2+2, 5JP menjadi 2+2+1."],
  ["3. Siapkan domain slot", "Unit 1JP boleh mencoba semua slot hari aktif. Unit 2JP hanya boleh mulai pada JP pertama pasangan: JP1, JP3, JP5, atau JP7 (Jumat: JP1, JP3, JP7)."],
  ["4. Cari penempatan", "CP, GA, atau Tabu mencari posisi semua unit dengan caranya masing-masing, tetapi memakai evaluator dan aturan yang sama."],
  ["5. Nilai hasil", "Evaluator menghitung hard violation dan soft penalty. Skor gabungan = 10.000 × hard + soft."],
  ["6. Terapkan bila layak", "Pada mode Adu Model, sistem hanya menerapkan hasil valid terbaik (hard = 0 dan soft terendah) bila opsi terapkan dipilih."],
];

function SectionTitle({ id, children, desc }: { id: string; children: React.ReactNode; desc?: string }) {
  return (
    <div id={id} className="scroll-mt-24">
      <h2 className="text-xl font-bold sm:text-2xl">{children}</h2>
      {desc && <p className="mt-1 text-sm leading-relaxed text-base-content/70">{desc}</p>}
    </div>
  );
}

function ParamTable({ rows }: { rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-box border border-base-300">
      <table className="table table-sm w-full min-w-[680px]">
        <thead><tr><th>Parameter</th><th>Nilai di aplikasi</th><th>Artinya</th><th>Dampak bila diubah</th></tr></thead>
        <tbody>{rows.map(r => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={i === 0 ? "font-semibold" : ""}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export default function KnowledgePage() {
  return (
    <div className="grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
      {/* Navigasi isi halaman */}
      <aside className="hidden lg:block">
        <div className="sticky top-20 rounded-box bg-base-100 p-3 shadow">
          <div className="px-2 pb-2 text-xs font-bold uppercase tracking-wide text-base-content/50">Isi Knowledge Base</div>
          <ul className="menu menu-sm w-full">
            <li><a href="#ringkasan">Ringkasan cepat</a></li>
            <li><a href="#model-masalah">Model masalah</a></li>
            <li><a href="#batasan-keras">Batasan keras</a></li>
            <li><a href="#batasan-halus">Batasan halus & skor</a></li>
            <li><a href="#alur">Alur solver</a></li>
            <li><a href="#cp">Model CP</a></li>
            <li><a href="#ga">Model GA Memetic</a></li>
            <li><a href="#tabu">Model Tabu Search</a></li>
            <li><a href="#parameter">Parameter pengguna</a></li>
            <li><a href="#membandingkan">Cara membandingkan model</a></li>
            <li><a href="#gagal">Bila solver tidak menemukan hasil</a></li>
            <li><a href="#batasan-sistem">Batasan sistem saat ini</a></li>
            <li><a href="#glosarium">Glosarium</a></li>
          </ul>
        </div>
      </aside>

      <article className="min-w-0 space-y-8">
        {/* HERO */}
        <section className="card overflow-hidden bg-primary text-primary-content shadow">
          <div className="card-body p-5 sm:p-7">
            <div className="badge badge-secondary w-fit">Knowledge Base</div>
            <h1 className="mt-2 text-2xl font-black leading-tight sm:text-4xl">Bagaimana algoritma penjadwalan bekerja?</h1>
            <p className="max-w-3xl text-sm leading-relaxed opacity-90 sm:text-base">
              Halaman ini menjelaskan model CP, GA Memetic, dan Tabu Search dengan bahasa sehari-hari: data apa yang dibaca,
              aturan apa yang tidak boleh dilanggar, kualitas apa yang dioptimalkan, parameter apa yang memengaruhi pencarian,
              dan bagaimana membaca hasil Adu Model.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href="#batasan-keras" className="btn btn-sm bg-base-100 text-base-content border-0">Mulai dari batasan</a>
              <Link href="/solver" className="btn btn-sm btn-secondary">Buka Solver</Link>
              <Link href="/aturan" className="btn btn-sm btn-outline border-primary-content/50 text-primary-content">Buka Aturan</Link>
            </div>
          </div>
        </section>

        {/* RINGKASAN */}
        <section className="space-y-3">
          <SectionTitle id="ringkasan">Ringkasan 1 menit</SectionTitle>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="card bg-base-100 shadow"><div className="card-body p-4">
              <div className="text-3xl">🧩</div><h3 className="font-bold">CP — penyusun sistematis</h3>
              <p className="text-sm text-base-content/70">Menempatkan unit satu per satu, mencoba slot yang sah, dan mundur (<i>backtrack</i>) bila jalan buntu. Bila selesai sebelum timeout, hasil yang dikembalikan pasti memenuhi batasan keras yang dimodelkan.</p>
              <div className="mt-2 flex gap-1"><span className="badge badge-success badge-outline">Validitas terkuat</span><span className="badge badge-outline">Deterministik*</span></div>
            </div></div>
            <div className="card bg-base-100 shadow"><div className="card-body p-4">
              <div className="text-3xl">🧬</div><h3 className="font-bold">GA Memetic — evolusi + perbaikan lokal</h3>
              <p className="text-sm text-base-content/70">Membuat banyak calon jadwal, memilih yang terbaik, mengawinkan sebagian penempatannya, memutasi sebagian kecil, lalu memperbaiki tiap anak dengan pencarian lokal.</p>
              <div className="mt-2 flex gap-1"><span className="badge badge-info badge-outline">Eksplorasi luas</span><span className="badge badge-outline">Acak</span></div>
            </div></div>
            <div className="card bg-base-100 shadow"><div className="card-body p-4">
              <div className="text-3xl">🧭</div><h3 className="font-bold">Tabu Search — pendaki yang mengingat jalan</h3>
              <p className="text-sm text-base-content/70">Memperbaiki satu jadwal langkah demi langkah. Gerakan yang baru dipakai dilarang sementara agar pencarian tidak berputar di tempat dan dipaksa menjelajah area lain.</p>
              <div className="mt-2 flex gap-1"><span className="badge badge-warning badge-outline">Perbaikan fokus</span><span className="badge badge-outline">Acak</span></div>
            </div></div>
          </div>
          <div className="alert alert-info text-sm"><span><b>Prinsip utamanya:</b> batasan keras harus dipenuhi dulu. Jadwal dengan hard violation &gt; 0 tidak dianggap layak, seberapa pun bagus nilai halusnya. Soft penalty baru dibandingkan setelah hard sama-sama 0.</span></div>
          <p className="text-xs text-base-content/60">*Urutan kandidat CP dibuat tetap untuk data yang sama, tetapi solver berhenti berdasarkan batas waktu nyata; pada data besar, apakah pencarian selesai dapat bergantung pada beban komputer.</p>
        </section>

        {/* MODEL MASALAH */}
        <section className="card bg-base-100 shadow"><div className="card-body space-y-4 p-4 sm:p-6">
          <SectionTitle id="model-masalah">1. Masalahnya diubah menjadi model apa?</SectionTitle>
          <p className="text-sm leading-relaxed">Anggap setiap <b>penugasan</b> adalah pekerjaan: “Guru A mengajar Mapel X di Kelas Y sebanyak N JP per minggu.” Solver harus menentukan <b>hari dan JP</b> untuk seluruh pekerjaan itu. Agar pola sekolah terjaga, pekerjaan tidak selalu ditempatkan per 1JP, melainkan dalam <b>unit</b>.</p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-box bg-base-200 p-4">
              <h3 className="font-bold">Unit yang ditempatkan</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li><b>Unit 2JP:</b> menempati dua JP sejajar dalam satu sesi, misalnya JP1–JP2 atau JP3–JP4.</li>
                <li><b>Unit 1JP:</b> menempati satu JP dan boleh berpasangan dengan 1JP lain di sesi yang sama.</li>
                <li>3JP → <b>2+1</b>; 4JP → <b>2+2</b>; 5JP → <b>2+2+1</b>; 2JP → satu unit 2JP; 1JP → satu unit 1JP.</li>
                <li>Di Jumat, pasangan yang sah adalah JP1–JP2, JP3–JP4, dan JP7–JP8.</li>
              </ul>
            </div>
            <div className="rounded-box bg-base-200 p-4">
              <h3 className="font-bold">Keputusan solver</h3>
              <p className="mt-2 text-sm leading-relaxed">Secara teknis, setiap unit adalah variabel. Nilainya adalah indeks slot yang dipilih, misalnya “unit IPA VII-A (2JP) → Selasa, mulai JP3”. Dari slot awal itu, sistem tahu unit menguasai JP3 dan JP4.</p>
              <p className="mt-2 text-sm leading-relaxed">Domain adalah daftar slot yang boleh dicoba. Domain unit 2JP jauh lebih sempit dibanding unit 1JP, karena hanya JP awal sesi yang boleh dipilih.</p>
            </div>
          </div>
          <div className="overflow-x-auto rounded-box border border-base-300">
            <table className="table table-sm w-full min-w-[650px]">
              <thead><tr><th>Input</th><th>Contoh</th><th> Dipakai untuk</th></tr></thead>
              <tbody>
                <tr><td className="font-semibold">Guru</td><td>Kode, nama, Maks JP/Hari</td><td>Menghindari bentrok dan beban harian berlebihan</td></tr>
                <tr><td className="font-semibold">Mapel</td><td>Kode, nama, Prefer Pagi</td><td>Identitas pelajaran dan preferensi soft ke pagi</td></tr>
                <tr><td className="font-semibold">Kelas</td><td>Nama kelas</td><td>Menghindari dua pelajaran pada kelas yang sama di waktu sama</td></tr>
                <tr><td className="font-semibold">Penugasan</td><td>Guru + Mapel + Kelas + JP/Minggu + Maks JP/Hari</td><td>Pekerjaan yang wajib ditempatkan solver</td></tr>
                <tr><td className="font-semibold">Ketidaktersediaan</td><td>Guru/kelas pada hari & JP tertentu</td><td>Larangan keras penempatan</td></tr>
                <tr><td className="font-semibold">Aturan</td><td>Hari aktif, pola 2JP, bobot, waktu</td><td>Membentuk domain dan fungsi penilaian</td></tr>
              </tbody>
            </table>
          </div>
        </div></section>

        {/* HARD */}
        <section className="card bg-base-100 shadow"><div className="card-body space-y-4 p-4 sm:p-6">
          <SectionTitle id="batasan-keras" desc="Batasan keras (hard constraints) adalah aturan yang tidak boleh dilanggar. Satu pelanggaran saja membuat jadwal tidak layak dipakai.">2. Batasan keras — tidak boleh dilanggar</SectionTitle>
          <div className="overflow-x-auto rounded-box border border-base-300">
            <table className="table table-sm w-full min-w-[820px]">
              <thead><tr><th>Batasan</th><th>Penjelasan mudah</th><th>Contoh pelanggaran</th><th>Sumber pengaturannya</th></tr></thead>
              <tbody>{hardConstraints.map(r => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={i === 0 ? "font-semibold" : ""}>{c}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="alert alert-success text-sm"><span><b>Hard = 0</b> berarti seluruh batasan keras di atas lolos. Inilah syarat minimum jadwal boleh diterapkan.</span></div>
            <div className="alert alert-warning text-sm"><span><b>Hard &gt; 0</b> bukan berarti “hampir bagus”. Jadwal tetap mengandung bentrok/larangan dan tidak boleh dipilih hanya karena soft-nya kecil.</span></div>
          </div>
          <p className="text-sm leading-relaxed"><b>Bagaimana jumlah JP bisa kurang?</b> Dalam generate normal, jumlah JP dipenuhi “berdasarkan konstruksi”: solver memang membuat tepat sejumlah unit dari JP/minggu, lalu setiap unit wajib mendapat slot. Jadi kegagalan biasanya tampil sebagai solver tidak selesai/tidak menemukan penempatan, bukan jadwal setengah jadi yang diam-diam diterapkan.</p>
        </div></section>

        {/* SOFT */}
        <section className="card bg-base-100 shadow"><div className="card-body space-y-4 p-4 sm:p-6">
          <SectionTitle id="batasan-halus" desc="Batasan halus (soft constraints) adalah preferensi kualitas. Melanggarnya tidak membuat jadwal mustahil, tetapi menaikkan penalti. Semakin kecil soft penalty, semakin nyaman jadwal menurut bobot yang dipilih sekolah.">3. Batasan halus & cara menghitung skor</SectionTitle>
          <div className="rounded-box bg-slate-900 p-4 text-center text-slate-50">
            <div className="text-xs uppercase tracking-widest opacity-70">Skor gabungan evaluator</div>
            <div className="mt-1 font-mono text-lg font-bold sm:text-2xl">Skor = 10.000 × Hard Violation + Soft Penalty</div>
            <p className="mt-2 text-sm opacity-80">Angka 10.000 sengaja besar. Satu pelanggaran keras selalu jauh lebih buruk daripada perbaikan halus biasa, sehingga algoritma dipaksa membereskan bentrok sebelum mengejar kenyamanan.</p>
          </div>
          <div className="overflow-x-auto rounded-box border border-base-300">
            <table className="table table-sm w-full min-w-[820px]">
              <thead><tr><th>Preferensi</th><th>Bobot awal</th><th>Cara hitung</th><th>Contoh</th></tr></thead>
              <tbody>{softConstraints.map(r => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={i === 0 ? "font-semibold" : ""}>{c}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-box bg-base-200 p-4"><h3 className="font-bold">Hard 0, Soft 25</h3><p className="mt-1 text-sm">Layak dipakai. Masih ada preferensi yang belum ideal, misalnya beberapa celah guru.</p></div>
            <div className="rounded-box bg-base-200 p-4"><h3 className="font-bold">Hard 0, Soft 8</h3><p className="mt-1 text-sm">Lebih baik daripada contoh di kiri karena sama-sama valid tetapi penaltinya lebih kecil.</p></div>
            <div className="rounded-box bg-error/10 p-4"><h3 className="font-bold text-error">Hard 1, Soft 0</h3><p className="mt-1 text-sm">Tidak layak. Skornya 10.000 dan tetap ada satu pelanggaran keras meski nilai halusnya sempurna.</p></div>
          </div>
          <div className="alert text-sm"><span><b>Catatan cara hitung celah:</b> evaluator membandingkan nomor JP dalam satu hari. Karena itu jeda panjang termasuk jam istirahat/ibadah dapat ikut terbaca sebagai celah numerik. Bobot w_gap menentukan seberapa kuat solver berusaha merapatkan jadwal guru.</span></div>
        </div></section>

        {/* WORKFLOW */}
        <section className="card bg-base-100 shadow"><div className="card-body space-y-4 p-4 sm:p-6">
          <SectionTitle id="alur">4. Alur bersama sebelum algoritma berjalan</SectionTitle>
          <ul className="steps steps-vertical w-full text-left lg:steps-horizontal">
            {workflow.map(([t]) => <li key={t} className="step step-primary"><span className="text-xs sm:text-sm">{t}</span></li>)}
          </ul>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {workflow.map(([t, d]) => <div key={t} className="rounded-box bg-base-200 p-4"><h3 className="font-bold">{t}</h3><p className="mt-1 text-sm leading-relaxed">{d}</p></div>)}
          </div>
        </div></section>

        {/* CP */}
        <section className="card border-t-4 border-success bg-base-100 shadow"><div className="card-body space-y-4 p-4 sm:p-6">
          <SectionTitle id="cp" desc="CP adalah singkatan dari Constraint Programming. Implementasi di aplikasi ini memakai backtracking dengan pemilihan unit prioritas dan penyaringan kandidat pada setiap langkah. Ini bukan OR-Tools CP-SAT; jaminan yang diberikan adalah: bila pencarian CP selesai dan mengembalikan solusi, solusi itu sudah melewati seluruh batasan keras model.">5. Model CP — mencari secara sistematis sampai terbukti dapat/tidak dapat</SectionTitle>
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-box bg-base-200 p-4">
              <h3 className="font-bold">Analogi sederhana</h3>
              <p className="mt-2 text-sm leading-relaxed">Bayangkan mengisi teka-teki dengan daftar aturan. CP menaruh satu unit pada slot sah. Jika kemudian unit berikutnya tidak punya tempat, CP tidak mengacak seluruh papan—ia mundur satu langkah, mencoba pilihan sebelumnya yang lain, lalu maju lagi.</p>
              <h3 className="mt-4 font-bold">Langkah kerja</h3>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                <li>Hitung jumlah slot kandidat awal setiap unit.</li>
                <li>Urutkan unit 2JP lebih dulu karena paling sulit ditempatkan, lalu unit dengan kandidat tersedikit (prinsip MRV: yang paling sempit dulu).</li>
                <li>Pilih unit berikutnya, saring slot yang saat itu masih sah terhadap bentrok, ketidaktersediaan, dan batas harian.</li>
                <li>Tempatkan unit. Untuk 2JP, kedua JP langsung ditandai terisi.</li>
                <li>Bila buntu, batalkan penempatan terakhir dan coba kandidat lain (backtracking).</li>
                <li>Berhenti saat semua unit terpasang atau waktu habis.</li>
              </ol>
            </div>
            <div className="space-y-3">
              <div className="rounded-box bg-success/10 p-4"><h3 className="font-bold">Kelebihan</h3><ul className="mt-1 list-disc pl-5 text-sm"><li>Paling rapi untuk membuktikan jadwal layak.</li><li>Tidak bergantung pada keberuntungan acak dalam struktur pencariannya.</li><li>Sangat baik ketika aturan ketat dan jumlah unit masih dapat dijelajahi.</li></ul></div>
              <div className="rounded-box bg-warning/10 p-4"><h3 className="font-bold">Kekurangan</h3><ul className="mt-1 list-disc pl-5 text-sm"><li>Ruang pencarian dapat meledak pada data besar/aturan yang saling mengunci.</li><li>Berorientasi menemukan solusi layak lebih dulu, bukan mengoptimalkan soft sampai paling rendah.</li><li>Bila timeout tercapai sebelum selesai, CP melaporkan belum menemukan solusi—itu bukan bukti bahwa solusi pasti tidak ada.</li></ul></div>
              <div className="rounded-box bg-base-200 p-4"><h3 className="font-bold">Kapan dipilih?</h3><p className="mt-1 text-sm">Saat prioritas utama adalah kepastian valid, sesudah mengubah banyak data/Aturan, atau untuk memeriksa apakah masalah masih mungkin diselesaikan.</p></div>
            </div>
          </div>
          <ParamTable rows={[
            ["Timeout per run", "Diatur di halaman Solver; API membatasi 2–60 detik. Nilai Aturan awal 10 detik", "Berapa lama CP boleh menjelajah sebelum menyerah pada percobaan itu", "Lebih lama memberi peluang selesai lebih besar, tetapi pengguna menunggu lebih lama"],
            ["Urutan unit", "Tetap di kode: unit 2JP dulu, kemudian domain tersedikit", "Unit yang paling berisiko buntu dicoba lebih awal", "Mengurangi mundur jauh di akhir pencarian"],
            ["Urutan kandidat slot", "Mapel prefer-pagi cenderung mencoba JP lebih awal; urutan lain dibuat deterministik dari posisi unit", "Menentukan cabang mana yang dicoba lebih dulu", "Dapat mengubah soft hasil pertama yang ditemukan dan waktu pencarian"],
            ["Batas harian & domain", "Diambil dari Data Master, Ketersediaan, hari aktif, dan pola 2JP", "Menyaring kandidat yang boleh dicoba", "Aturan lebih sempit = domain lebih kecil dan risiko timeout/buntu lebih besar"],
          ]} />
        </div></section>

        {/* GA */}
        <section className="card border-t-4 border-info bg-base-100 shadow"><div className="card-body space-y-4 p-4 sm:p-6">
          <SectionTitle id="ga" desc="GA berarti Genetic Algorithm. Versi aplikasi adalah Memetic Algorithm: evolusi populasi digabung local search, sehingga bukan GA murni yang hanya mengandalkan kawin silang dan mutasi.">6. Model GA Memetic — membiakkan calon jadwal lalu memperbaikinya</SectionTitle>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-box bg-base-200 p-4">
              <h3 className="font-bold">Analogi sederhana</h3>
              <p className="mt-2 text-sm leading-relaxed">GA memelihara sekumpulan “individu”, dan satu individu adalah satu rancangan jadwal lengkap. Individu berskor baik dipilih sebagai orang tua. Anaknya mewarisi bagian awal jadwal dari satu orang tua dan sisanya dari orang tua lain, sedikit gennya diubah acak, lalu anak itu “dilatih” lagi melalui perbaikan lokal.</p>
              <h3 className="mt-4 font-bold">Langkah kerja</h3>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                <li>Bentuk 24 individu awal secara acak dalam domain yang sah untuk tipe unitnya.</li>
                <li>Perbaiki setiap individu dengan local search (maksimal 400 putaran pemindaian).</li>
                <li>Urutkan berdasarkan skor gabungan; skor lebih kecil lebih baik.</li>
                <li>Ambil 8 terbaik sebagai kelompok orang tua dan pertahankan 6 terbaik (elit).</li>
                <li>Buat 16 anak dengan crossover satu titik dari dua orang tua.</li>
                <li>Mutasi maksimal 3 posisi pada sebagian anak, selalu ke slot yang termasuk domain unit tersebut.</li>
                <li>Jalankan local search maksimal 60 putaran pada setiap anak.</li>
                <li>Gabungkan elit + anak, pilih 24 terbaik, ulangi sampai skor terbaik 0 atau timeout.</li>
              </ol>
            </div>
            <div className="space-y-3">
              <div className="rounded-box bg-info/10 p-4"><h3 className="font-bold">Kelebihan</h3><ul className="mt-1 list-disc pl-5 text-sm"><li>Menjelajah banyak pola jadwal sekaligus.</li><li>Sering menemukan soft rendah karena bagian baik dari dua jadwal bisa digabung.</li><li>Local search membuat anak tidak dibiarkan rusak terlalu lama.</li></ul></div>
              <div className="rounded-box bg-warning/10 p-4"><h3 className="font-bold">Kekurangan</h3><ul className="mt-1 list-disc pl-5 text-sm"><li>Stochastic: hasil dapat berbeda setiap run.</li><li>Tidak memberi bukti bahwa solusi adalah optimum global.</li><li>Jika seluruh populasi terjebak di pola buruk, crossover dapat mengulang pola yang sama.</li><li>Berhenti saat skor total 0; bila soft ideal 0 tidak tercapai, ia dapat bekerja sampai timeout walau sudah hard 0.</li></ul></div>
              <div className="rounded-box bg-base-200 p-4"><h3 className="font-bold">Kapan dipilih?</h3><p className="mt-1 text-sm">Saat CP lambat, data besar, atau sekolah ingin beberapa alternatif pola demi mengejar soft penalty lebih rendah.</p></div>
            </div>
          </div>
          <ParamTable rows={[
            ["Ukuran populasi", "24 individu (tetap di kode)", "Jumlah rancangan jadwal yang dipelihara setiap generasi", "Lebih besar = lebih beragam tetapi lebih lambat per generasi"],
            ["Orang tua & elit", "8 orang tua teratas; 6 elit dipertahankan", "Menyeimbangkan kualitas dan keberagaman", "Elit terlalu dominan dapat mengurangi variasi"],
            ["Jumlah anak", "16 per generasi", "Keturunan baru menggantikan sebagian populasi", "Lebih banyak anak = eksplorasi lebih luas per generasi"],
            ["Crossover", "Satu titik potong acak", "Anak mengambil urutan unit dari dua orang tua", "Menggabungkan pola awal dan akhir dari dua jadwal"],
            ["Mutasi", "Hingga 3 posisi; peluang per posisi 40% pada proses mutasi anak", "Mengubah slot satu unit ke kandidat sahnya", "Membantu keluar dari pola yang stagnan; terlalu agresif dapat merusak pola baik"],
            ["Local search awal / anak", "Maksimal 400 / 60 putaran", "Memindai pemindahan unit yang menurunkan skor", "Inilah bagian “memetic”-nya; mempercepat validitas tetapi menambah waktu"],
            ["Timeout", "Diatur per run, 2–60 detik", "Batas total evolusi", "Lebih lama memberi lebih banyak generasi"],
          ]} />
        </div></section>

        {/* TABU */}
        <section className="card border-t-4 border-warning bg-base-100 shadow"><div className="card-body space-y-4 p-4 sm:p-6">
          <SectionTitle id="tabu" desc="Tabu Search adalah pencarian lokal yang dilengkapi ingatan jangka pendek. Ingatan itu disebut tabu list: gerakan yang baru dilakukan dilarang diulangi untuk sementara, kecuali gerakan tersebut menghasilkan jadwal terbaik yang pernah ditemukan.">7. Model Tabu Search — fokus memperbaiki satu jadwal tanpa berputar-putar</SectionTitle>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-box bg-base-200 p-4">
              <h3 className="font-bold">Analogi sederhana</h3>
              <p className="mt-2 text-sm leading-relaxed">Bayangkan pendaki mencari titik terendah di lembah berkabut. Setiap langkah, ia mencoba beberapa gerakan. Jalan yang baru saja dipakai ditempeli tanda “jangan kembali dulu selama 12 langkah”, sehingga ia tidak mondar-mandir di dua titik yang sama. Bila sebuah jalan terlarang ternyata menuju rekor terbaik, ia tetap boleh dipakai—aspirasi.</p>
              <h3 className="mt-4 font-bold">Langkah kerja</h3>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                <li>Mulai dari satu jadwal acak yang sudah diperbaiki local search.</li>
                <li>Setiap iterasi, bangkitkan 60 calon gerakan untuk dinilai.</li>
                <li>Sekitar 60% gerakan memindahkan satu unit ke slot kandidat lain; sisanya mencoba menukar dua unit bila domain keduanya mengizinkan.</li>
                <li>Pilih calon berskor terendah yang tidak tabu, atau yang memecahkan rekor terbaik global.</li>
                <li>Tandai gerakan terpilih sebagai tabu selama 12 iterasi.</li>
                <li>Simpan jadwal terbaik yang pernah ditemui, bukan hanya posisi terakhir.</li>
                <li>Di akhir, jadwal terbaik dipoles lagi dengan local search maksimal 300 putaran.</li>
              </ol>
            </div>
            <div className="space-y-3">
              <div className="rounded-box bg-warning/10 p-4"><h3 className="font-bold">Kelebihan</h3><ul className="mt-1 list-disc pl-5 text-sm"><li>Fokus dan biasanya cepat memperbaiki jadwal yang sudah hampir valid.</li><li>Tabu list mencegah siklus pendek.</li><li>Menyimpan best-ever, sehingga langkah eksplorasi buruk tidak menghapus hasil terbaik.</li></ul></div>
              <div className="rounded-box bg-error/10 p-4"><h3 className="font-bold">Kekurangan</h3><ul className="mt-1 list-disc pl-5 text-sm"><li>Masih stochastic dan tidak membuktikan optimum global.</li><li>Kualitas sangat dipengaruhi titik awal serta gerakan acak yang kebetulan dicoba.</li><li>Hanya 60 calon yang disampel per iterasi, jadi gerakan terbaik teoritis bisa terlewat.</li></ul></div>
              <div className="rounded-box bg-base-200 p-4"><h3 className="font-bold">Kapan dipilih?</h3><p className="mt-1 text-sm">Saat ingin perbaikan cepat dari masalah berukuran sedang, CP terlalu lama, atau sebagai pembanding GA dalam Adu Model.</p></div>
            </div>
          </div>
          <ParamTable rows={[
            ["Calon per iterasi", "60 gerakan (tetap di kode)", "Berapa pemindahan/tukar yang dibandingkan sebelum memilih satu langkah", "Lebih banyak = langkah lebih teliti tetapi iterasi lebih lambat"],
            ["Jenis gerakan", "60% pindah satu unit, 40% percobaan tukar", "Menyeimbangkan perubahan kecil dan pertukaran posisi", "Tukar hanya terjadi bila kedua slot tetap berada dalam domain masing-masing"],
            ["Tabu tenure", "12 iterasi", "Berapa lama gerakan unit→slot dilarang diulang", "Terlalu singkat mudah berputar; terlalu lama dapat menutup jalan baik"],
            ["Aspirasi", "Gerakan tabu boleh dipilih bila mengalahkan rekor global", "Pengecualian agar larangan tidak mengorbankan solusi terbaik", "Membantu ketika tabu list terlalu ketat"],
            ["Polishing akhir", "Local search maksimal 300 putaran", "Memindai pemindahan yang masih menurunkan skor", "Membersihkan pelanggaran/soft yang tersisa pada best-ever"],
            ["Timeout", "Diatur per run, 2–60 detik", "Batas jumlah iterasi secara tidak langsung", "Lebih lama memberi lebih banyak sampel gerakan"],
          ]} />
        </div></section>

        {/* PARAMETERS */}
        <section className="card bg-base-100 shadow"><div className="card-body space-y-4 p-4 sm:p-6">
          <SectionTitle id="parameter" desc="Tidak semua parameter berada di layar. Parameter data/Aturan menentukan masalahnya, parameter run menentukan lamanya pencarian, dan parameter internal menentukan perilaku algoritma.">8. Parameter yang dibutuhkan setiap model</SectionTitle>
          <div className="overflow-x-auto rounded-box border border-base-300">
            <table className="table table-sm w-full min-w-[840px]">
              <thead><tr><th>Parameter</th><th>Diatur dari</th><th>CP</th><th>GA</th><th>Tabu</th><th>Catatan</th></tr></thead>
              <tbody>
                <tr><td className="font-semibold">Guru, mapel, kelas</td><td>Data Master / Excel</td><td>✓</td><td>✓</td><td>✓</td><td>Entitas dasar masalah</td></tr>
                <tr><td className="font-semibold">Penugasan & JP/Minggu</td><td>Data Master</td><td>✓</td><td>✓</td><td>✓</td><td>Menentukan jumlah unit wajib</td></tr>
                <tr><td className="font-semibold">Maks JP guru per hari</td><td>Data Guru</td><td>✓</td><td>✓</td><td>✓</td><td>0 = tidak dibatasi aturan ini</td></tr>
                <tr><td className="font-semibold">Maks JP penugasan per hari</td><td>Data Penugasan</td><td>✓</td><td>✓</td><td>✓</td><td>0 = tidak dibatasi aturan ini</td></tr>
                <tr><td className="font-semibold">Ketidaktersediaan</td><td>Menu Ketersediaan</td><td>✓</td><td>✓</td><td>✓</td><td>Larangan guru dan kelas</td></tr>
                <tr><td className="font-semibold">Hari aktif</td><td>Menu Aturan</td><td>✓</td><td>✓</td><td>✓</td><td>Mengubah jumlah dan jenis slot</td></tr>
                <tr><td className="font-semibold">Pola 2JP</td><td>Menu Aturan</td><td>✓</td><td>✓</td><td>✓</td><td>Mengubah unit dan domain kandidat</td></tr>
                <tr><td className="font-semibold">Prefer Pagi mapel</td><td>Data Mapel</td><td>✓</td><td>✓</td><td>✓</td><td>Soft; CP juga memprioritaskan kandidat pagi lebih awal</td></tr>
                <tr><td className="font-semibold">w_gap, w_sore, w_sebar</td><td>Menu Aturan</td><td>Dinilai di hasil</td><td>✓</td><td>✓</td><td>CP mencari layak dulu; GA/Tabu memakai bobot selama pencarian</td></tr>
                <tr><td className="font-semibold">Timeout per model</td><td>Halaman Solver</td><td>✓</td><td>✓</td><td>✓</td><td>Dibatasi 2–60 detik oleh API</td></tr>
                <tr><td className="font-semibold">Populasi, mutasi, elit</td><td>Tetap di kode</td><td>—</td><td>✓</td><td>—</td><td>Belum dibuka sebagai pengaturan UI</td></tr>
                <tr><td className="font-semibold">Tabu tenure & sampel</td><td>Tetap di kode</td><td>—</td><td>—</td><td>✓</td><td>12 iterasi dan 60 calon/iterasi</td></tr>
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-box bg-base-200 p-4"><h3 className="font-bold">Parameter yang paling memengaruhi kesulitan</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm"><li>Total JP dibanding total slot guru/kelas yang tersedia.</li><li>Ketidaktersediaan yang menumpuk pada hari/JP populer.</li><li>Batas Maks JP/Hari yang kecil.</li><li>Pola 2JP aktif, terutama untuk penugasan berbatas 1 JP per hari.</li><li>Sedikit guru untuk mapel yang sama-sama dibutuhkan banyak kelas.</li></ul></div>
            <div className="rounded-box bg-base-200 p-4"><h3 className="font-bold">Parameter yang memengaruhi “rasa” jadwal</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm"><li>Naikkan <b>w_gap</b> bila jadwal guru terlalu bolong.</li><li>Naikkan <b>w_sore</b> bila mapel tertentu harus di pagi.</li><li>Naikkan <b>w_sebar</b> bila mapel tidak boleh menumpuk dalam sehari.</li><li>Bobot 0 mematikan preferensi terkait (kecuali batas yang memang hard).</li></ul></div>
          </div>
        </div></section>

        {/* COMPARISON */}
        <section className="card bg-base-100 shadow"><div className="card-body space-y-4 p-4 sm:p-6">
          <SectionTitle id="membandingkan" desc="Mode Adu Model menjalankan CP, GA, lalu Tabu dengan data, domain, evaluator, dan timeout per model yang sama agar perbandingannya adil.">9. Cara membaca & membandingkan hasil model</SectionTitle>
          <div className="overflow-x-auto rounded-box border border-base-300">
            <table className="table table-sm w-full min-w-[760px]">
              <thead><tr><th>Urutan menilai</th><th>Makna</th><th>Keputusan</th></tr></thead>
              <tbody>
                <tr><td className="font-bold">1. Hard violation</td><td>Jumlah pelanggaran aturan wajib</td><td>Buang hasil hard &gt; 0 dari pilihan utama</td></tr>
                <tr><td className="font-bold">2. Soft penalty</td><td>Kualitas kenyamanan berdasarkan bobot</td><td>Di antara hard 0, pilih soft paling kecil</td></tr>
                <tr><td className="font-bold">3. Waktu</td><td>Berapa detik solver bekerja</td><td>Penting bila dua hasil kualitasnya sama/berdekatan</td></tr>
                <tr><td className="font-bold">4. Stabilitas</td><td>Apakah model berulang kali memberi hasil baik</td><td>Jalankan GA/Tabu beberapa kali; jangan menilai dari satu keberuntungan</td></tr>
                <tr><td className="font-bold">5. Kesesuaian operasional</td><td>Apakah pola hasil mudah diterima guru/kelas</td><td>Periksa papan, bukan hanya angka</td></tr>
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-box bg-success/10 p-4"><b>Pilih CP</b><p className="mt-1 text-sm">Bila selesai cepat dan hard 0. Ini pilihan paling konservatif untuk validitas.</p></div>
            <div className="rounded-box bg-info/10 p-4"><b>Pilih GA</b><p className="mt-1 text-sm">Bila hard 0 dan soft-nya jelas lebih rendah, terutama pada data besar/beragam.</p></div>
            <div className="rounded-box bg-warning/10 p-4"><b>Pilih Tabu</b><p className="mt-1 text-sm">Bila hard 0, soft kompetitif, dan waktu jauh lebih singkat.</p></div>
          </div>
          <p className="text-sm leading-relaxed">Dalam mode <b>Adu Model + Terapkan</b>, aplikasi otomatis mengambil hasil hard 0 dengan soft terendah. Jika soft seri, hasil valid yang ditemukan lebih dulu menurut urutan CP → GA → Tabu yang dipertahankan. Bila tidak ada model yang hard 0, tidak ada hasil yang diterapkan.</p>
          <div className="alert alert-warning text-sm"><span><b>Jangan membandingkan soft lintas bobot berbeda.</b> Jika w_gap/w_sore/w_sebar diubah, angka soft dari run lama bukan lagi ukuran kualitas yang setara. Bandingkan model pada data dan Aturan yang sama.</span></div>
        </div></section>

        {/* TROUBLESHOOT */}
        <section className="card bg-base-100 shadow"><div className="card-body space-y-4 p-4 sm:p-6">
          <SectionTitle id="gagal" desc="“Tidak ditemukan” tidak selalu berarti datanya salah. Bisa jadi masalah memang mustahil, domain terlalu sempit, atau algoritma kehabisan waktu sebelum mencapai wilayah solusi.">10. Bila solver tidak menemukan jadwal valid</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-box bg-base-200 p-4"><h3 className="font-bold">Penyebab yang sering terjadi</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm"><li>Total JP guru/kelas lebih besar daripada slot yang tersedia.</li><li>Terlalu banyak ketidaktersediaan pada slot yang sama.</li><li>Maks JP/Hari guru atau penugasan terlalu kecil.</li><li>Pola 2JP aktif, tetapi batas penugasan per hari 1 JP membuat unit 2JP tidak dapat muat.</li><li>Banyak kelas memerlukan guru yang sama pada rentang hari yang sempit.</li><li>Timeout terlalu pendek untuk ukuran masalah.</li></ul></div>
            <div className="rounded-box bg-base-200 p-4"><h3 className="font-bold">Langkah memeriksa secara aman</h3><ol className="mt-2 list-decimal space-y-1 pl-5 text-sm"><li>Jalankan CP dengan timeout lebih panjang untuk menguji kelayakan.</li><li>Periksa penugasan ber-JP besar dan guru dengan beban tertinggi.</li><li>Longgarkan satu batas pada satu waktu, lalu jalankan lagi agar penyebabnya terlihat.</li><li>Uji pola 2JP nonaktif hanya sebagai diagnosis—bila langsung berhasil, konfliknya ada pada pola/batas harian.</li><li>Jangan menerapkan hasil hard &gt; 0; gunakan GA/Tabu untuk melihat seberapa dekat mereka bisa mencapai hard 0.</li></ol></div>
          </div>
          <p className="text-sm"><b>Interpretasi CP timeout:</b> “CP belum selesai membuktikan.” <b>Interpretasi GA/Tabu hard &gt; 0:</b> “pencarian acak ini belum menemukan.” Keduanya bukan vonis final bahwa jadwal mustahil, kecuali pencarian lengkap berhasil membuktikan seluruh ruang tidak layak—implementasi saat ini tidak menampilkan sertifikat ketidaklayakan seperti itu.</p>
        </div></section>

        {/* LIMITS */}
        <section className="card bg-base-100 shadow"><div className="card-body space-y-4 p-4 sm:p-6">
          <SectionTitle id="batasan-sistem" desc="Agar ekspektasi tepat, berikut hal yang saat ini benar-benar ditegakkan kode aplikasi—dibedakan dari data yang sudah tersimpan tetapi belum menjadi aturan solver.">11. Batasan sistem saat ini (transparan)</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-box bg-success/10 p-4"><h3 className="font-bold">Sudah ditegakkan</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm"><li>Bentrok guru dan kelas.</li><li>Ketidaktersediaan guru dan kelas.</li><li>Batas guru & penugasan per hari bila nilainya &gt; 0.</li><li>JP Jumat yang sah dan pola unit 2JP bila aktif.</li><li>Tiga preferensi soft pada tabel di atas.</li><li>Validasi ulang yang sama dipakai untuk drag & drop dan persetujuan pengajuan.</li></ul></div>
            <div className="rounded-box bg-warning/10 p-4"><h3 className="font-bold">Belum menjadi batasan solver</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm"><li><b>Maks JP/Minggu guru:</b> kolomnya tersedia di Data Master, tetapi evaluator saat ini belum menghitungnya sebagai hard/soft.</li><li><b>Ruangan:</b> belum menjadi variabel keputusan atau batasan kapasitas.</li><li><b>Kelas pecah/gabung:</b> memerlukan model kelompok/peserta khusus; belum menjadi bagian solver unit saat ini.</li><li>Urutan mapel, mapel yang harus/tidak boleh berdampingan, dan preferensi hari tertentu belum tersedia sebagai Aturan umum.</li><li>Waktu tempuh guru antar gedung/lokasi belum dimodelkan.</li></ul></div>
          </div>
          <p className="text-sm leading-relaxed">Jam yang tampil pada kepala papan (misalnya 07:30–08:10) berfungsi sebagai label waktu dan pembentuk struktur JP. Untuk Jumat, struktur JP yang sah ditegakkan; teks jam dapat diatur di Aturan, tetapi durasi menit belum menjadi variabel optimasi tersendiri.</p>
        </div></section>

        {/* GLOSSARY */}
        <section className="card bg-base-100 shadow"><div className="card-body space-y-4 p-4 sm:p-6">
          <SectionTitle id="glosarium">12. Glosarium singkat</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[
              ["Constraint", "Aturan yang membatasi penempatan jadwal."],
              ["Hard constraint", "Aturan wajib; dilanggar berarti jadwal tidak layak."],
              ["Soft constraint", "Preferensi; dilanggar berarti penalti bertambah."],
              ["Domain", "Daftar slot yang boleh dicoba oleh satu unit."],
              ["Unit", "Potongan penugasan yang ditempatkan solver: 2JP atau 1JP."],
              ["Backtracking", "Mundur dan mencoba pilihan lain setelah menemukan jalan buntu."],
              ["MRV", "Minimum Remaining Values: dahulukan variabel dengan pilihan tersedikit."],
              ["Fitness / skor", "Angka mutu calon jadwal; di aplikasi ini lebih kecil lebih baik."],
              ["Crossover", "Mengawinkan dua jadwal: sebagian unit dari orang tua A, sisanya dari B."],
              ["Mutasi", "Perubahan acak kecil pada slot sebuah unit."],
              ["Local search", "Memperbaiki jadwal dengan mencoba pemindahan yang menurunkan skor."],
              ["Memetic", "GA yang setiap individunya diperbaiki dengan local search."],
              ["Tabu list", "Daftar gerakan yang sementara dilarang agar tidak berputar."],
              ["Tabu tenure", "Lama sebuah gerakan bertahan dalam tabu list."],
              ["Aspirasi", "Pengecualian: gerakan tabu boleh diambil jika menghasilkan rekor terbaik."],
              ["Timeout", "Batas waktu pencarian untuk satu model dalam satu run."],
              ["Feasible", "Layak: seluruh batasan keras terpenuhi (hard = 0)."],
              ["Optimum global", "Jadwal terbaik yang mungkin secara matematis; GA/Tabu tidak menjamin menemukannya."],
            ].map(([t, d]) => <div key={t} className="rounded-box bg-base-200 p-3"><b>{t}</b><p className="mt-0.5 text-sm text-base-content/70">{d}</p></div>)}
          </div>
          <div className="alert alert-success text-sm"><span><b>Kesimpulan:</b> gunakan CP untuk kepastian layak, GA untuk eksplorasi kualitas, dan Tabu untuk perbaikan cepat. Untuk keputusan paling aman, jalankan <b>Adu Model</b>, utamakan hard = 0, kemudian bandingkan soft dan waktu pada data & Aturan yang sama.</span></div>
          <div className="flex flex-wrap gap-2">
            <Link href="/solver" className="btn btn-primary btn-sm">🤖 Jalankan Solver</Link>
            <Link href="/aturan" className="btn btn-outline btn-sm">⚙️ Atur Bobot & Pola</Link>
            <Link href="/jadwal" className="btn btn-outline btn-sm">🧩 Lihat Papan Jadwal</Link>
          </div>
        </div></section>
      </article>
    </div>
  );
}
