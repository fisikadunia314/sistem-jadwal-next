import db, { getSettings } from "./db";
export const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
export const PPD = 8;
export const GENERAL_TIMES: Record<number, string> = {1:"07:30-08:10",2:"08:10-08:50",3:"09:20-10:05",4:"10:05-10:40",5:"10:40-11:15",6:"11:15-11:50",7:"13:30-14:10",8:"14:10-14:50"};
export const FRIDAY_TIMES: Record<number, string> = {1:"07:30-08:10",2:"08:10-08:50",3:"09:20-09:55",4:"09:55-10:30",7:"14:00-14:40",8:"14:40-15:20"};
export function activeDays(): string[] { const s = getSettings().active_days || ""; const d = s.split(",").map(x=>x.trim()).filter(Boolean); return d.length ? d : DAYS.slice(0,5); }
export function timesMap(day: string): Record<number,string> { const st = getSettings(); try { return JSON.parse(day==="Jumat" ? st.times_friday : st.times_general); } catch { return day==="Jumat" ? FRIDAY_TIMES : GENERAL_TIMES; } }
export const periodsList = (day: string) => day === "Jumat" ? [1,2,3,4,7,8] : [1,2,3,4,5,6,7,8];
export const timeOf = (day: string, p: number) => timesMap(day)[p] || (day === "Jumat" ? FRIDAY_TIMES[p] : GENERAL_TIMES[p]) || "";
export type Entry = { id: number; assignment_id: number; day: string; period: number;
  teacher_id: number; class_id: number; subject_id: number; tname: string; tcode: string; sname: string; scode: string; cname: string };
export function allEntries(): Entry[] {
  return db.prepare(`SELECT e.*, a.teacher_id, a.class_id, a.subject_id, t.name tname, t.code tcode,
    s.name sname, s.code scode, c.name cname FROM entries e JOIN assignments a ON a.id=e.assignment_id
    JOIN teachers t ON t.id=a.teacher_id JOIN subjects s ON s.id=a.subject_id JOIN classes c ON c.id=a.class_id`).all() as Entry[];
}
export function validate(entries: Entry[]): string[] {
  const viol: string[] = [];
  const seen = new Map<string, number>();
  const unT = new Set((db.prepare("SELECT entity_id,day,period FROM unavailability WHERE entity_type='teacher'").all() as any[]).map(r => `${r.entity_id}|${r.day}|${r.period}`));
  const unC = new Set((db.prepare("SELECT entity_id,day,period FROM unavailability WHERE entity_type='class'").all() as any[]).map(r => `${r.entity_id}|${r.day}|${r.period}`));
  const teachers = new Map((db.prepare("SELECT * FROM teachers").all() as any[]).map(t => [t.id, t]));
  const assigns = new Map((db.prepare("SELECT * FROM assignments").all() as any[]).map(a => [a.id, a]));
  const dayCount = new Map<string, number>();
  for (const e of entries) {
    for (const [kind, ent] of [["Guru", e.teacher_id], ["Kelas", e.class_id]] as const) {
      const k = `${kind}|${ent}|${e.day}|${e.period}`;
      if (seen.has(k)) viol.push(`Bentrok ${kind} pada ${e.day} JP${e.period}`); seen.set(k, e.id);
    }
    if (!periodsList(e.day).includes(e.period)) viol.push(`JP tidak berlaku pada ${e.day} JP${e.period}`);
    if (unT.has(`${e.teacher_id}|${e.day}|${e.period}`)) viol.push(`Guru tidak tersedia pada ${e.day} JP${e.period}`);
    if (unC.has(`${e.class_id}|${e.day}|${e.period}`)) viol.push(`Kelas tidak tersedia pada ${e.day} JP${e.period}`);
    const kd = `T|${e.teacher_id}|${e.day}`; dayCount.set(kd, (dayCount.get(kd) || 0) + 1);
    const ka = `A|${e.assignment_id}|${e.day}`; dayCount.set(ka, (dayCount.get(ka) || 0) + 1);
  }
  for (const [k, n] of dayCount) {
    const [kind, id, day] = k.split("|");
    const mx = kind === "T" ? teachers.get(+id)?.max_jp_day : assigns.get(+id)?.max_jp_day;
    if (mx && n > mx) viol.push(`${kind === "T" ? "Guru" : "Mapel"} melebihi Maks JP/Hari (${n}>${mx}) pada ${day}`);
  }
  return [...new Set(viol)];
}
export function moveOptions(entry: Entry, entries: Entry[], pair?: Entry | null) {
  // Mode BLOK 2JP: dua kartu JP berurutan milik penugasan yang sama digeser bersama
  // ke satu blok target (JP ganjil+genapnya). Status blok ditulis ke kedua JP.
  if (pair) {
    const blocks: [number, number][] = [];
    for (const d of activeDays()) { const ps = periodsList(d); for (let i = 0; i + 1 < ps.length; i += 2) { if (d !== entry.day || ps[i] !== Math.min(entry.period, pair.period)) blocks.push([ps[i], ps[i+1]]); } }
    const slots: any[] = [];
    for (const d of activeDays()) {
      const ps = periodsList(d);
      for (let i = 0; i + 1 < ps.length; i += 2) {
        const [p1, p2] = [ps[i], ps[i+1]];
        const isNow = d === entry.day && (p1 === entry.period || p1 === pair.period);
        const trial = entries.map(x => x.id === entry.id ? { ...x, day: d, period: p1 } : x.id === pair.id ? { ...x, day: d, period: p2 } : x);
        const v = isNow ? [] : validate(trial);
        const st = isNow ? "sekarang" : v.length ? "tidak" : "bisa";
        const reason = isNow ? "Blok saat ini (2 JP)" : v.length ? v[0] : "Aman dipindah sebagai blok 2 JP ke sini";
        slots.push({ day: d, period: p1, time: timeOf(d, p1), status: st, reason });
        slots.push({ day: d, period: p2, time: timeOf(d, p2), status: st, reason });
      }
    }
    return { slots, swaps: [] as number[], isBlock: true };
  }
  const slots: any[] = []; const days = DAYS.filter(d => entries.length ? true : true).slice(0, 5);
  for (const d of activeDays()) {
    for (const p of periodsList(d)) {
      if (d === entry.day && p === entry.period) { slots.push({ day: d, period: p, time: timeOf(d, p), status: "sekarang", reason: "Posisi saat ini" }); continue; }
      const trial = entries.map(x => x.id === entry.id ? { ...x, day: d, period: p } : x);
      const v = validate(trial);
      slots.push({ day: d, period: p, time: timeOf(d, p), status: v.length ? "tidak" : "bisa", reason: v.length ? v[0] : "Aman dipindah ke sini" });
    }
  }
  const swaps: number[] = [];
  for (const o of entries) {
    if (o.id === entry.id || (o.day === entry.day && o.period === entry.period)) continue;
    const trial = entries.map(x => x.id === entry.id ? { ...x, day: o.day, period: o.period } : x.id === o.id ? { ...x, day: entry.day, period: entry.period } : x);
    if (!validate(trial).length) swaps.push(o.id);
  }
  return { slots, swaps };
}
