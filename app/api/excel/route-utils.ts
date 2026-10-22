// Util bersama import/export Excel. File internal (bukan route).
export const SHEETS = {
  teachers: { sheet: "Guru", headers: ["KodeGuru", "NamaGuru", "MaksJPHari", "MaksJPMinggu", "WarnaHEX"] },
  subjects: { sheet: "Mapel", headers: ["KodeMapel", "NamaMapel", "PreferPagi"] },
  classes: { sheet: "Kelas", headers: ["NamaKelas"] },
  assignments: { sheet: "Penugasan", headers: ["KodeGuru", "KodeMapel", "NamaKelas", "JPMinggu", "MaksJPHari"] },
  unavailability: { sheet: "Ketidaktersediaan", headers: ["Tipe", "KodeAtauNama", "Hari", "JP"] },
} as const;
export const norm = (x: any) => String(x ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
export function mapRow(r: any, aliases: Record<string, string[]>): any {
  const byNorm = new Map(Object.entries(r).map(([k, v]) => [norm(k), v]));
  const out: any = {};
  for (const [field, names] of Object.entries(aliases)) for (const n of names) if (byNorm.has(n)) { out[field] = byNorm.get(n); break; }
  return out;
}
export const blankRow = (r: any) => Object.values(r).every(v => String(v ?? "").trim() === "");
export const num = (v: any, def = 0) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? Math.trunc(n) : def; };
