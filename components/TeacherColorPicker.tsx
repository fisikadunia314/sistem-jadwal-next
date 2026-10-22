"use client";
import { useEffect, useMemo, useState } from "react";

type UsedColor = { code: string; name: string; color_hex: string };
type Recommendation = { color_hex: string; text_color: string; min_distance: number };

const MIN_DISTANCE = 15; // Delta E 2000 minimum (longgar)
function normalize(v: string): string | null {
  let x = (v || "").trim();
  if (!x) return null;
  if (!x.startsWith("#")) x = `#${x}`;
  if (/^#[0-9a-fA-F]{3}$/.test(x)) x = `#${x[1]}${x[1]}${x[2]}${x[2]}${x[3]}${x[3]}`;
  return /^#[0-9a-fA-F]{6}$/.test(x) ? x.toUpperCase() : null;
}
function rgb(hex: string) { const v = normalize(hex) || "#000000"; return { r: parseInt(v.slice(1, 3), 16), g: parseInt(v.slice(3, 5), 16), b: parseInt(v.slice(5, 7), 16) }; }
function textOn(hex: string) {
  const { r, g, b } = rgb(hex);
  const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return (lum + 0.05) / 0.05 >= 1.05 / (lum + 0.05) ? "#111827" : "#FFFFFF";
}
function lab(hex: string) { const { r, g, b } = rgb(hex); const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; const R = lin(r), G = lin(g), B = lin(b); const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, Y = 0.2126 * R + 0.7152 * G + 0.0722 * B, Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883; const ft = (t: number) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; const fx = ft(X), fy = ft(Y), fz = ft(Z); return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) }; }
function distance(a: string, b: string) { // Delta E CIEDE2000 (persepsi)
  const l1 = lab(a), l2 = lab(b); const C1 = Math.hypot(l1.a, l1.b), C2 = Math.hypot(l2.a, l2.b), Cb = (C1 + C2) / 2;
  const G = Cb ? 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7))) : 0; const ap1 = (1 + G) * l1.a, ap2 = (1 + G) * l2.a;
  const Cp1 = Math.hypot(ap1, l1.b), Cp2 = Math.hypot(ap2, l2.b); const hp = (ap: number, bb: number) => { if (ap === 0 && bb === 0) return 0; const h = Math.atan2(bb, ap) * 180 / Math.PI; return h < 0 ? h + 360 : h; };
  const hp1 = hp(ap1, l1.b), hp2 = hp(ap2, l2.b); const dLp = l2.L - l1.L, dCp = Cp2 - Cp1; let dhp = 0;
  if (Cp1 * Cp2 !== 0) { dhp = hp2 - hp1; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
  const dHp = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin(dhp * Math.PI / 360); const Lbp = (l1.L + l2.L) / 2, Cbp = (Cp1 + Cp2) / 2;
  let hbp: number; if (Cp1 * Cp2 === 0) hbp = hp1 + hp2; else if (Math.abs(hp1 - hp2) <= 180) hbp = (hp1 + hp2) / 2; else if (hp1 + hp2 < 360) hbp = (hp1 + hp2 + 360) / 2; else hbp = (hp1 + hp2 - 360) / 2;
  const T = 1 - 0.17 * Math.cos((hbp - 30) * Math.PI / 180) + 0.24 * Math.cos(2 * hbp * Math.PI / 180) + 0.32 * Math.cos((3 * hbp + 6) * Math.PI / 180) - 0.20 * Math.cos((4 * hbp - 63) * Math.PI / 180);
  const dth = 30 * Math.exp(-(((hbp - 275) / 25) ** 2)); const Rc = Cbp ? 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7)) : 0;
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2); const Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T; const Rt = -Math.sin(2 * dth * Math.PI / 180) * Rc;
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}
function hexToHsl(hex: string) {
  const { r, g, b } = rgb(hex); const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B); const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min; const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0; if (max === R) h = ((G - B) / d + (G < B ? 6 : 0)); else if (max === G) h = (B - R) / d + 2; else h = (R - G) / d + 4;
  return { h: Math.round(h * 60), s: Math.round(s * 100), l: Math.round(l * 100) };
}
function hslToHex(h: number, s: number, l: number) {
  s /= 100; l /= 100; const k = (n: number) => (n + h / 30) % 12; const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

export default function TeacherColorPicker({ value, onChange, excludeId, label = "GURU", sample = "MTK" }: {
  value: string; onChange: (color: string) => void; excludeId?: number | null; label?: string; sample?: string;
}) {
  const current = normalize(value) || "#64748B";
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(current);
  const [hsl, setHsl] = useState(() => hexToHsl(current));
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [used, setUsed] = useState<UsedColor[]>([]);
  const [loading, setLoading] = useState(false);

  function setColor(hex: string) { const c = normalize(hex); if (!c) { setDraft(hex.toUpperCase()); return; } setDraft(c); setHsl(hexToHsl(c)); }
  async function loadRecommendations(variasi = false) {
    setLoading(true);
    try {
      const seed = variasi ? Math.floor(Math.random() * 90000) + 1 : 0;
      const r = await fetch(`/api/teachers/recommended-colors?excludeId=${excludeId || ""}&seed=${seed}`).then(x => x.json());
      if (r.ok) { setRecommendations(r.colors || []); setUsed(r.used || []); }
    } finally { setLoading(false); }
  }
  function openPicker() { setColor(current); setOpen(true); loadRecommendations(); }
  useEffect(() => { if (!open) setDraft(current); }, [current, open]);

  const valid = normalize(draft);
  const nearest = useMemo(() => {
    if (!valid) return null;
    let best: { row: UsedColor; d: number } | null = null;
    for (const row of used) { const d = distance(valid, row.color_hex); if (!best || d < best.d) best = { row, d }; }
    return best;
  }, [draft, used, valid]);
  const tooClose = !!nearest && nearest.d < MIN_DISTANCE;
  const exact = !!nearest && nearest.d === 0;

  function slider(kind: "h" | "s" | "l", val: number) {
    const next = { ...hsl, [kind]: val }; setHsl(next); setDraft(hslToHex(next.h, next.s, next.l));
  }

  return (
    <>
      <button type="button" onClick={openPicker} className="flex items-center gap-2 rounded-lg border border-base-300 bg-base-100 px-2 py-1.5 text-left shadow-sm hover:border-primary" title="Buka pemilih warna">
        <span className="h-8 w-11 rounded-md border border-black/25" style={{ background: current }} />
        <span><span className="block text-xs font-bold leading-tight">{current}</span><span className="block text-[10px] leading-tight text-base-content/55">Klik untuk memilih…</span></span>
        <span className="rounded px-2 py-1 text-[11px] font-bold" style={{ background: current, color: textOn(current) }}>{sample}</span>
      </button>

      {open && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-3" role="dialog" aria-modal="true">
        <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-5">
          <div className="flex items-start gap-3">
            <div><h3 className="text-lg font-bold">🎨 Pilih Warna — {label}</h3><p className="text-xs text-slate-500">Klik rekomendasi, geser slider, atau ketik HEX. Preview dan peringatan kemiripan berubah langsung.</p></div>
            <button type="button" className="btn btn-ghost btn-sm ml-auto" onClick={() => setOpen(false)}>✕</button>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-[180px_1fr]">
            <div>
              <div className="flex h-24 items-center justify-center rounded-xl border-2 border-black/15 text-2xl font-black shadow-inner" style={{ background: valid || "#64748B", color: valid ? textOn(valid) : "#fff" }}>{sample}</div>
              <div className="mt-2 text-center"><code className="font-bold">{draft}</code><div className="text-[11px] text-slate-500">Teks otomatis: {valid ? textOn(valid) : "—"}</div></div>
              <label className="mt-3 block text-xs font-semibold text-slate-600">Kode HEX<input className="input input-bordered input-sm mt-1 w-full uppercase" value={draft} onChange={e => setColor(e.target.value)} placeholder="#2563EB" /></label>
              <label className="mt-2 block text-xs font-semibold text-slate-600">Pilih dari perangkat<input type="color" className="mt-1 h-10 w-full cursor-pointer rounded border bg-white p-1" value={valid || "#64748B"} onChange={e => setColor(e.target.value)} /></label>
            </div>

            <div>
              <div className="flex items-center justify-between"><b className="text-sm">⭐ Rekomendasi aman</b><button type="button" className="btn btn-outline btn-xs" disabled={loading} onClick={() => loadRecommendations(true)}>{loading ? "Memuat…" : "↻ Rekomendasi lain"}</button></div>
              <p className="text-[11px] text-slate-500">Geser/klik warna berikut — semuanya dihitung berjauhan dari warna guru lain.</p>
              <div className="mt-2 flex snap-x gap-2 overflow-x-auto pb-2">
                {recommendations.map(r => <button type="button" key={r.color_hex} onClick={() => setColor(r.color_hex)} className={`w-20 shrink-0 snap-start rounded-xl border-2 p-1.5 text-left ${valid === r.color_hex ? "border-black" : "border-transparent bg-slate-50"}`}>
                  <span className="flex h-12 items-center justify-center rounded-lg text-xs font-black" style={{ background: r.color_hex, color: r.text_color }}>{sample}</span>
                  <span className="mt-1 block text-[10px] font-bold">{r.color_hex}</span><span className="block text-[9px] text-slate-500">ΔE {r.min_distance}</span>
                </button>)}
                {!recommendations.length && <span className="text-xs text-slate-400">{loading ? "Sedang menghitung rekomendasi…" : "Rekomendasi belum tersedia."}</span>}
              </div>

              <div className="mt-3 space-y-3">
                <label className="block text-xs font-semibold text-slate-600">Warna dasar / Hue — {hsl.h}°
                  <input type="range" min={0} max={360} value={hsl.h} onChange={e => slider("h", +e.target.value)} className="w-full" style={{ accentColor: hslToHex(hsl.h, 90, 50) }} /></label>
                <label className="block text-xs font-semibold text-slate-600">Kejenuhan / Saturation — {hsl.s}%
                  <input type="range" min={0} max={100} value={hsl.s} onChange={e => slider("s", +e.target.value)} className="w-full" style={{ accentColor: hslToHex(hsl.h, hsl.s, 50) }} /></label>
                <label className="block text-xs font-semibold text-slate-600">Terang-gelap / Lightness — {hsl.l}%
                  <input type="range" min={15} max={85} value={hsl.l} onChange={e => slider("l", +e.target.value)} className="w-full" style={{ accentColor: hslToHex(hsl.h, hsl.s, hsl.l) }} /></label>
              </div>

              <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${!valid ? "bg-red-50 text-red-700" : exact ? "bg-red-50 text-red-700" : tooClose ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>
                {!valid ? "Format HEX belum valid. Gunakan format seperti #2563EB." : exact ? `⛔ Warna ini persis sama dengan ${nearest?.row.code} — ${nearest?.row.name}. Geser slider atau pilih rekomendasi.` : tooClose ? `⚠️ Masih agak mirip dengan ${nearest?.row.code} — ${nearest?.row.name} (${nearest?.row.color_hex}), ΔE ${Math.round(nearest?.d || 0)}; minimum ${MIN_DISTANCE}. Geser lagi sampai aman.` : `✅ Aman: paling dekat dengan ${nearest ? `${nearest.row.code} (${nearest.row.color_hex})` : "—"}, ΔE ${nearest ? Math.round(nearest.d) : "—"}.`}
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Batal</button>
            <button type="button" className="btn btn-primary btn-sm" disabled={!valid || tooClose} onClick={() => { if (valid) { onChange(valid); setOpen(false); } }}>Pakai Warna Ini</button>
          </div>
        </div>
      </div>}
    </>
  );
}
