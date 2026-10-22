// Warna khusus guru: disimpan sebagai HEX di teachers.color_hex.
// Aturan: format #RRGGBB, tidak boleh sama persis dengan guru lain, dan diusahakan
// berjarak cukup jauh di ruang RGB agar perbedaan antar guru terlihat jelas.
import db from "./db";

// Jarak warna sekarang diukur secara PERSEPSI: Delta E 2000 di ruang CIELAB
// (cara mata manusia membedakan warna), bukan jarak RGB yang menipu.
export const MIN_COLOR_DISTANCE = 15; // Delta E 2000 minimum antar guru (dilonggarkan: yang penting jelas terlihat beda)
export const MIN_DELTA_E = MIN_COLOR_DISTANCE;

export function normalizeHex(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let v = input.trim();
  if (!v) return null;
  if (!v.startsWith("#")) v = `#${v}`;
  if (/^#[0-9a-fA-F]{3}$/.test(v)) v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v.toUpperCase() : null;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const v = normalizeHex(hex) || "#000000";
  return { r: parseInt(v.slice(1, 3), 16), g: parseInt(v.slice(3, 5), 16), b: parseInt(v.slice(5, 7), 16) };
}

export function srgbToLab(hex: string): { L: number; a: number; b: number } {
  const { r, g, b } = hexToRgb(hex);
  const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const R = lin(r), G = lin(g), B = lin(b);
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const ft = (t: number) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const fx = ft(X), fy = ft(Y), fz = ft(Z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

// Delta E CIEDE2000: 0 = sama persis; ~2,3 baru terasa; >=25 jelas berbeda.
export function deltaE00(a: string, b: string): number {
  const l1 = srgbToLab(a), l2 = srgbToLab(b);
  const C1 = Math.hypot(l1.a, l1.b), C2 = Math.hypot(l2.a, l2.b), Cb = (C1 + C2) / 2;
  const G = Cb ? 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7))) : 0;
  const ap1 = (1 + G) * l1.a, ap2 = (1 + G) * l2.a;
  const Cp1 = Math.hypot(ap1, l1.b), Cp2 = Math.hypot(ap2, l2.b);
  const hp = (ap: number, bb: number) => { if (ap === 0 && bb === 0) return 0; const h = Math.atan2(bb, ap) * 180 / Math.PI; return h < 0 ? h + 360 : h; };
  const hp1 = hp(ap1, l1.b), hp2 = hp(ap2, l2.b);
  const dLp = l2.L - l1.L, dCp = Cp2 - Cp1;
  let dhp = 0;
  if (Cp1 * Cp2 !== 0) { dhp = hp2 - hp1; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
  const dHp = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin(dhp * Math.PI / 360);
  const Lbp = (l1.L + l2.L) / 2, Cbp = (Cp1 + Cp2) / 2;
  let hbp: number;
  if (Cp1 * Cp2 === 0) hbp = hp1 + hp2;
  else if (Math.abs(hp1 - hp2) <= 180) hbp = (hp1 + hp2) / 2;
  else if (hp1 + hp2 < 360) hbp = (hp1 + hp2 + 360) / 2;
  else hbp = (hp1 + hp2 - 360) / 2;
  const T = 1 - 0.17 * Math.cos((hbp - 30) * Math.PI / 180) + 0.24 * Math.cos(2 * hbp * Math.PI / 180) + 0.32 * Math.cos((3 * hbp + 6) * Math.PI / 180) - 0.20 * Math.cos((4 * hbp - 63) * Math.PI / 180);
  const dth = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Rc = Cbp ? 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7)) : 0;
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * dth * Math.PI / 180) * Rc;
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}

// Nama lama dipertahankan: sekarang berarti jarak persepsi Delta E 2000.
export function colorDistance(a: string, b: string): number { return deltaE00(a, b); }

// Urutan Halton (low-discrepancy): kandidat warna tersebar merata & deterministik,
// pengganti acak murni — inti farthest-point sampling ala library distinctipy.
function halton(index: number, base: number): number {
  let f = 1, r = 0, i = index;
  while (i > 0) { f /= base; r += f * (i % base); i = Math.floor(i / base); }
  return r;
}
export function colorCandidates(count = 1024, offset = 0): string[] {
  const out: string[] = [];
  for (let i = 1 + offset; i <= count + offset; i++) {
    const h = halton(i, 2) * 360;
    const s = 45 + halton(i, 3) * 45;   // 45–90%
    const l = 32 + halton(i, 5) * 43;   // 32–75%
    out.push(hslToHex(h, s, l));
  }
  return out;
}

// Warna teks otomatis: pilih hitam/putih berdasarkan kontras WCAG terhadap latar.
export function textColorFor(bg: string): string {
  const { r, g, b } = hexToRgb(bg);
  const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const contrastBlack = (lum + 0.05) / 0.05;
  const contrastWhite = 1.05 / (lum + 0.05);
  return contrastBlack >= contrastWhite ? "#111827" : "#FFFFFF";
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

type TeacherColorRow = { id: number; code: string; name: string; color_hex: string | null };

function teacherRows(excludeId?: number | null): TeacherColorRow[] {
  const rows = db.prepare("SELECT id,code,name,color_hex FROM teachers ORDER BY id").all() as TeacherColorRow[];
  return rows.filter(r => !excludeId || r.id !== excludeId).map(r => ({ ...r, color_hex: normalizeHex(r.color_hex) }));
}

export function validateTeacherColor(input: unknown, excludeId?: number | null):
  | { ok: true; color: string }
  | { ok: false; error: string } {
  const color = normalizeHex(input);
  if (!color) return { ok: false, error: "Warna harus dalam format HEX, misalnya #2563EB." };
  let nearest: { row: TeacherColorRow; distance: number } | null = null;
  for (const row of teacherRows(excludeId)) {
    if (!row.color_hex) continue;
    if (row.color_hex === color) return { ok: false, error: `Warna ${color} sudah dipakai ${row.code} — ${row.name}. Pilih warna lain atau klik Acak.` };
    const d = colorDistance(color, row.color_hex);
    if (!nearest || d < nearest.distance) nearest = { row, distance: d };
  }
  if (nearest && nearest.distance < MIN_COLOR_DISTANCE) {
    return { ok: false, error: `Warna ${color} terlalu mirip dengan warna ${nearest.row.code} — ${nearest.row.name} (${nearest.row.color_hex}, jarak ${Math.round(nearest.distance)}; minimum ${MIN_COLOR_DISTANCE}). Geser warnanya lebih jauh atau klik Acak.` };
  }
  return { ok: true, color };
}

export function randomTeacherColor(excludeId?: number | null): string {
  const used = teacherRows(excludeId).map(r => r.color_hex).filter(Boolean) as string[];
  let best = "#2563EB"; let bestDistance = -1;
  // Farthest-point sampling: pilih kandidat yang jarak Delta E-nya ke semua warna terpakai paling besar.
  for (const candidate of colorCandidates(1600)) {
    if (used.includes(candidate)) continue;
    const minDistance = used.length ? Math.min(...used.map(u => colorDistance(candidate, u))) : 100;
    if (minDistance > bestDistance) { bestDistance = minDistance; best = candidate; }
    if (minDistance >= MIN_COLOR_DISTANCE + 15) break;
  }
  // Ruang warna sudah sangat padat: kembalikan kandidat yang paling jauh dari semua warna terpakai.
  return best;
}

export function ensureTeacherColors(): void {
  const rows = db.prepare("SELECT id,color_hex FROM teachers ORDER BY id").all() as { id: number; color_hex: string | null }[];
  const seen = new Set<string>();
  for (const row of rows) {
    const color = normalizeHex(row.color_hex);
    if (color && !seen.has(color)) { seen.add(color); continue; }
    const assigned = randomTeacherColor(row.id);
    db.prepare("UPDATE teachers SET color_hex=? WHERE id=?").run(assigned, row.id);
    seen.add(assigned);
  }
}

// Rekomendasi warna untuk popup pemilih: kandidat dipilih bergantian (greedy maximin)
// agar berjauhan dari warna guru lain DAN dari rekomendasi yang sudah dipilih sebelumnya.
export function recommendedTeacherColors(excludeId?: number | null, count = 12, seed = 0): { color_hex: string; text_color: string; min_distance: number }[] {
  const used = teacherRows(excludeId).filter(r => r.color_hex).map(r => ({ code: r.code, name: r.name, color_hex: r.color_hex as string }));
  const selected: string[] = [];
  const out: { color_hex: string; text_color: string; min_distance: number }[] = [];
  const pool = colorCandidates(2400, seed % 997);
  // Untuk SATU guru yang sedang memilih, syarat wajibnya adalah jauh dari warna guru LAIN.
  // Antar-rekomendasi cukup diberi jarak keberagaman ringan (>=12) agar pilihannya banyak dan bervariasi,
  // bukan syarat penuh — toh hanya satu yang akan dipilih.
  const scored = pool
    .filter(candidate => !used.some(u => u.color_hex === candidate))
    .map(candidate => ({ candidate, minUsed: Math.min(...used.map(u => colorDistance(candidate, u.color_hex as string))) }))
    .filter(x => x.minUsed >= MIN_COLOR_DISTANCE)
    .sort((a, b) => b.minUsed - a.minUsed);
  for (const x of scored) {
    if (out.length >= count) break;
    if (selected.some(sel => colorDistance(x.candidate, sel) < 12)) continue;
    selected.push(x.candidate);
    out.push({ color_hex: x.candidate, text_color: textColorFor(x.candidate), min_distance: Math.round(x.minUsed) });
  }
  return out;
}

export function usedTeacherColors(excludeId?: number | null): { code: string; name: string; color_hex: string }[] {
  return teacherRows(excludeId).filter(r => r.color_hex).map(r => ({ code: r.code, name: r.name, color_hex: r.color_hex as string }));
}
