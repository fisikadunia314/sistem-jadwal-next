"use client";
import { useEffect, useState } from "react";
import TeacherColorPicker from "@/components/TeacherColorPicker";

export default function ProfilPage() {
  const [p, setP] = useState<any>(null);
  const [form, setForm] = useState({ display_name: "", username: "" });
  const [pw, setPw] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [msg, setMsg] = useState("");
  const [users, setUsers] = useState<any[]>([]); const [teachers, setTeachers] = useState<any[]>([]);
  const [uf, setUf] = useState<any>({ username: "", display_name: "", password: "", role: "pegawai", teacher_id: "" });
  const [editId, setEditId] = useState<number | null>(null);
  const [teacherColor, setTeacherColor] = useState("#2563EB");

  async function load() {
    const r = await fetch("/api/profile").then(x => x.json());
    if (r.ok) { setP(r.profile); setForm({ display_name: r.profile.display_name, username: r.profile.username }); setTeacherColor(r.profile.teacher?.color_hex || "#2563EB"); }
    else setMsg("⚠️ " + r.error);
    const u = await fetch("/api/users").then(x => x.json()).catch(() => null);
    if (u?.ok) { setUsers(u.rows); setTeachers(u.teachers); }
  }
  useEffect(() => { load(); }, []);

  async function saveProfile() {
    const r = await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }).then(x => x.json());
    setMsg(r.ok ? "✅ " + r.message + " Memuat ulang halaman…" : "⚠️ " + r.error);
    if (r.ok) setTimeout(() => location.reload(), 700);
  }
  const textOn = (hex: string) => { const v = /^#[0-9a-fA-F]{6}$/.test(hex || "") ? hex : "#64748B"; const n = parseInt(v.slice(1), 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.62 ? "#111827" : "#FFFFFF"; };
  async function saveTeacherColor(random = false) {
    const r = await fetch("/api/profile/color", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(random ? { random: true } : { color_hex: teacherColor }) }).then(x => x.json());
    if (r.ok) { setTeacherColor(r.color_hex); setP((prev: any) => prev ? { ...prev, teacher: { ...prev.teacher, color_hex: r.color_hex } } : prev); }
    setMsg(r.ok ? "✅ " + r.message : "⚠️ " + r.error);
  }
  async function savePassword() {
    const r = await fetch("/api/profile/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pw) }).then(x => x.json());
    setMsg(r.ok ? "✅ " + r.message : "⚠️ " + r.error);
    if (r.ok) setPw({ current_password: "", new_password: "", confirm_password: "" });
  }
  async function saveUser() {
    const url = editId ? `/api/users/${editId}` : "/api/users";
    const r = await fetch(url, { method: editId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(uf) }).then(x => x.json());
    setMsg(r.ok ? "✅ " + r.message : "⚠️ " + r.error);
    if (r.ok) { setEditId(null); setUf({ username: "", display_name: "", password: "", role: "pegawai", teacher_id: "" }); load(); }
  }
  async function deleteUser(id: number, name: string) {
    if (!confirm(`Hapus akun ${name}? Tindakan ini tidak dapat dibatalkan.`)) return;
    const r = await fetch(`/api/users/${id}`, { method: "DELETE" }).then(x => x.json());
    setMsg(r.ok ? "✅ " + r.message : "⚠️ " + r.error); load();
  }

  if (!p) return <div className="card bg-base-100 p-6 shadow">Memuat profil…</div>;
  const isAdmin = p.role === "admin";

  return (
    <div className="space-y-5">
      {msg && <div className="alert shadow text-sm"><span>{msg}</span></div>}
      <section className="card bg-base-100 shadow"><div className="card-body p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="avatar placeholder"><div className="w-20 rounded-full bg-primary text-primary-content"><span className="text-3xl font-bold">{p.display_name.slice(0,1).toUpperCase()}</span></div></div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold">{p.display_name}</h1>
            <p className="text-base-content/60">@{p.username} • ID akun {p.id}</p>
            <div className="mt-2 flex flex-wrap gap-2"><span className={`badge ${isAdmin ? "badge-primary" : "badge-secondary"}`}>{isAdmin ? "Superadmin" : "Pegawai"}</span>
            {p.teacher ? <span className="badge badge-outline">Terhubung: {p.teacher.code} — {p.teacher.name}</span> : <span className="badge badge-warning badge-outline">Belum terhubung ke data guru</span>}</div>
          </div>
        </div>
        <div className="stats mt-5 grid grid-cols-2 shadow md:grid-cols-4">
          <div className="stat p-3"><div className="stat-title text-xs">Penugasan Saya</div><div className="stat-value text-2xl">{p.stats.assignments}</div></div>
          <div className="stat p-3"><div className="stat-title text-xs">Total JP/Minggu</div><div className="stat-value text-2xl">{p.stats.jp_week}</div></div>
          <div className="stat p-3"><div className="stat-title text-xs">JP Terjadwal</div><div className="stat-value text-2xl">{p.stats.scheduled}</div></div>
          <div className="stat p-3"><div className="stat-title text-xs">Pengajuan Pending</div><div className="stat-value text-2xl">{p.requests.pending}</div><div className="stat-desc">dari {p.requests.total} pengajuan</div></div>
        </div>
        {p.teacher && <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-box bg-base-200 p-3"><span className="text-base-content/60">Kode Guru</span><br/><b>{p.teacher.code}</b></div>
          <div className="rounded-box bg-base-200 p-3"><span className="text-base-content/60">Maks JP/Hari Guru</span><br/><b>{p.teacher.max_jp_day || "Tidak dibatasi"}</b></div>
          <div className="rounded-box bg-base-200 p-3"><span className="text-base-content/60">Maks JP/Minggu*</span><br/><b>{p.teacher.max_jp_week || "Tidak dibatasi"}</b></div>
        </div>}
        {p.teacher && <p className="mt-2 text-xs text-base-content/50">*Maks JP/Minggu saat ini baru tersimpan sebagai data profil guru; batas yang ditegakkan solver adalah Maks JP/Hari. Lihat Knowledge Base untuk status batasan yang aktif.</p>}
        {p.teacher && <div className="mt-4 rounded-box border border-base-300 bg-base-100 p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1">
              <div className="font-bold">🎨 Warna Saya di Papan Jadwal</div>
              <p className="text-xs text-base-content/60">Tersimpan di data guru dalam format HEX. Tidak boleh sama/terlalu mirip dengan guru lain; warna teks di papan dihitung otomatis agar berlawanan dan terbaca.</p>
            </div>
            <TeacherColorPicker value={teacherColor} excludeId={p.teacher.id} label={`${p.teacher.code} — ${p.teacher.name}`} onChange={setTeacherColor} />
            <span className="rounded-lg px-3 py-2 text-sm font-bold" style={{ background: teacherColor, color: textOn(teacherColor) }}>{p.teacher.code} • Contoh Kartu</span>
            <button className="btn btn-outline btn-sm" onClick={() => saveTeacherColor(true)}>🎲 Acak Unik</button>
            <button className="btn btn-primary btn-sm" onClick={() => saveTeacherColor(false)}>Simpan Warna</button>
          </div>
        </div>}
        {!p.teacher && !isAdmin && <div className="alert alert-warning mt-4 text-sm"><span>Akun Anda belum dikaitkan ke data guru oleh Superadmin. Setelah dikaitkan, jadwal dan ketidaktersediaan pribadi Anda akan muncul penuh.</span></div>}
      </div></section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card bg-base-100 shadow"><div className="card-body p-4 sm:p-5">
          <h2 className="card-title text-lg">✏️ Ubah Profil</h2>
          <label className="form-control"><span className="label-text">Nama tampilan</span><input className="input input-bordered w-full" value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} /></label>
          <label className="form-control"><span className="label-text">Username untuk login</span><input className="input input-bordered w-full" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} /></label>
          <p className="text-xs text-base-content/60">Username harus unik, minimal 3 karakter, dan tanpa spasi. Peran dan kaitan guru tidak dapat diubah dari profil sendiri.</p>
          <button className="btn btn-primary btn-sm w-fit" onClick={saveProfile}>Simpan Profil</button>
        </div></section>

        <section className="card bg-base-100 shadow"><div className="card-body p-4 sm:p-5">
          <h2 className="card-title text-lg">🔐 Ganti Password</h2>
          <label className="form-control"><span className="label-text">Password lama</span><input type="password" className="input input-bordered w-full" value={pw.current_password} onChange={e => setPw({ ...pw, current_password: e.target.value })} /></label>
          <label className="form-control"><span className="label-text">Password baru</span><input type="password" className="input input-bordered w-full" value={pw.new_password} onChange={e => setPw({ ...pw, new_password: e.target.value })} /></label>
          <label className="form-control"><span className="label-text">Konfirmasi password baru</span><input type="password" className="input input-bordered w-full" value={pw.confirm_password} onChange={e => setPw({ ...pw, confirm_password: e.target.value })} /></label>
          <button className="btn btn-secondary btn-sm w-fit" onClick={savePassword}>Ganti Password</button>
        </div></section>
      </div>

      {isAdmin && <section className="card bg-base-100 shadow"><div className="card-body p-4 sm:p-5">
        <h2 className="card-title text-lg">👥 Kelola Akun Pengguna (CRUD Profil)</h2>
        <p className="text-sm text-base-content/60">Superadmin dapat membuat akun, mengubah nama/username/peran, mengaitkan akun pegawai ke data guru, mereset password, dan menghapus akun. Akun sendiri serta Superadmin terakhir dilindungi agar tidak terhapus/terturunkan.</p>
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-box bg-base-200 p-3">
          <label className="text-xs">Username<br/><input className="input input-bordered input-sm" value={uf.username} onChange={e => setUf({ ...uf, username: e.target.value })} /></label>
          <label className="text-xs">Nama tampilan<br/><input className="input input-bordered input-sm" value={uf.display_name} onChange={e => setUf({ ...uf, display_name: e.target.value })} /></label>
          <label className="text-xs">{editId ? "Password baru (opsional)" : "Password"}<br/><input type="password" className="input input-bordered input-sm" value={uf.password} onChange={e => setUf({ ...uf, password: e.target.value })} /></label>
          <label className="text-xs">Peran<br/><select className="select select-bordered select-sm" value={uf.role} onChange={e => setUf({ ...uf, role: e.target.value })}><option value="pegawai">Pegawai</option><option value="admin">Superadmin</option></select></label>
          <label className="text-xs">Kaitkan ke guru<br/><select className="select select-bordered select-sm" value={uf.teacher_id} onChange={e => setUf({ ...uf, teacher_id: e.target.value })}><option value="">— belum dikaitkan —</option>{teachers.map(t => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}</select></label>
          <button className="btn btn-success btn-sm" onClick={saveUser}>{editId ? "Simpan Akun" : "Tambah Akun"}</button>
          {editId && <button className="btn btn-ghost btn-sm" onClick={() => { setEditId(null); setUf({ username: "", display_name: "", password: "", role: "pegawai", teacher_id: "" }); }}>Batal</button>}
        </div>
        <div className="mt-3 overflow-x-auto rounded-box border border-base-300">
          <table className="table table-sm w-full min-w-[720px]"><thead><tr><th>ID</th><th>Username</th><th>Nama</th><th>Peran</th><th>Guru Terhubung</th><th>Aksi</th></tr></thead>
          <tbody>{users.map(x => <tr key={x.id}><td>{x.id}</td><td>@{x.username}</td><td>{x.display_name}</td><td><span className={`badge badge-sm ${x.role === "admin" ? "badge-primary" : "badge-secondary"}`}>{x.role === "admin" ? "Superadmin" : "Pegawai"}</span></td><td>{x.tname ? `${x.tcode} — ${x.tname}` : <span className="text-warning">Belum dikaitkan</span>}</td>
            <td className="whitespace-nowrap"><button className="btn btn-ghost btn-xs" onClick={() => { setEditId(x.id); setUf({ username: x.username, display_name: x.display_name, password: "", role: x.role, teacher_id: x.teacher_id || "" }); }}>✏️ Edit</button>
            <button className="btn btn-ghost btn-xs text-error" onClick={() => deleteUser(x.id, x.display_name)}>🗑️ Hapus</button></td></tr>)}</tbody></table>
        </div>
      </div></section>}
    </div>
  );
}
