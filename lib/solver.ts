// Solver TypeScript murni (tanpa modul native):
// - CP  : backtracking + MRV + forward-checking. Bila selesai, hasilnya PASTI 0 hard violation.
//         (Pengganti CP-SAT OR-Tools yang tidak tersedia sebagai modul Node; jaminan validitas sama.)
// - GA  : Genetic Algorithm + local search (Memetic).
// - Tabu: Tabu Search.
// Skor bersama: 10000 * hard_violation + soft_penalty.
import db, { getSettings, tx } from "./db";
import { activeDays, periodsList } from "./schedule";

export type Lesson = { assignment_id: number; teacher_id: number; class_id: number; subject_id: number; prefer_pagi: number };
// Unit penempatan solver. size=2 adalah SATU BLOK 2JP (dua JP berurutan dalam satu blok:
// JP1-2 / JP3-4 / JP5-6 / JP7-8; Jumat JP1-2, JP3-4, JP7-8). size=1 adalah sisa 1JP.
// Aturan pola: jp_week dipecah floor(jp/2) unit blok + (jp ganjil ? 1 unit tunggal) -> 3JP=2+1, 4JP=2+2, 5JP=2+2+1.
export type Unit = Lesson & { size: 1 | 2 };
export type Slot = { day: string; period: number };

export function loadProblem() {
  const st = getSettings();
  const w = { gap: Number(st.w_gap || 3), sore: Number(st.w_sore || 1), sebar: Number(st.w_sebar || 2) };
  const assignments = db.prepare(`SELECT a.*, s.prefer_pagi FROM assignments a JOIN subjects s ON s.id=a.subject_id`).all() as any[];
  const teachers = new Map((db.prepare("SELECT * FROM teachers").all() as any[]).map(t => [t.id, t]));
  const pattern = st.pola_blok !== "0";
  const units: Unit[] = [];
  for (const a of assignments) {
    const base = { assignment_id: a.id, teacher_id: a.teacher_id, class_id: a.class_id, subject_id: a.subject_id, prefer_pagi: a.prefer_pagi || 0 };
    const jp = a.jp_week || 0;
    if (!pattern) { for (let i = 0; i < jp; i++) units.push({ ...base, size: 1 }); }
    else { const nBlock = Math.floor(jp / 2); for (let i = 0; i < nBlock; i++) units.push({ ...base, size: 2 }); if (jp % 2 === 1) units.push({ ...base, size: 1 }); }
  }
  const slots: Slot[] = [];
  for (const d of activeDays()) for (const p of periodsList(d)) slots.push({ day: d, period: p });
  const slotIdx = new Map(slots.map((s, i) => [`${s.day}|${s.period}`, i]));
  // slot pertama tiap blok (JP ganjil sejajar blok) & pasangan JP kedua untuk unit blok
  const blockStarts = new Set<number>(); const pairOf = new Map<number, number>();
  for (const d of activeDays()) { const ps = periodsList(d); for (let i = 0; i + 1 < ps.length; i += 2) { const a = slotIdx.get(`${d}|${ps[i]}`)!, b = slotIdx.get(`${d}|${ps[i + 1]}`)!; blockStarts.add(a); pairOf.set(a, b); } }
  const unitSlots: number[][] = units.map(u => u.size === 2 ? [...blockStarts] : slots.map((_, i) => i));
  const unT = new Set((db.prepare("SELECT entity_id,day,period FROM unavailability WHERE entity_type='teacher'").all() as any[]).map(r => `${r.entity_id}|${r.day}|${r.period}`));
  const unC = new Set((db.prepare("SELECT entity_id,day,period FROM unavailability WHERE entity_type='class'").all() as any[]).map(r => `${r.entity_id}|${r.day}|${r.period}`));
  const aMaxDay = new Map(assignments.map(a => [a.id, a.max_jp_day || 0]));
  return { units, slots, slotIdx, blockStarts, pairOf, unitSlots, unT, unC, teachers, aMaxDay, w, pattern };
}
type P = ReturnType<typeof loadProblem>;

export function evaluate(assign: number[], P: P): { hard: number; soft: number } {
  let hard = 0, soft = 0;
  const tSlot = new Map<string, number>(), cSlot = new Map<string, number>();
  const tDay = new Map<string, number>(), aDay = new Map<string, number>(), tDayPeriods = new Map<string, number[]>();
  P.units.forEach((L, i) => {
    const occ = L.size === 2 ? [assign[i], P.pairOf.get(assign[i]) ?? assign[i]] : [assign[i]];
    for (const oi of occ) {
      const s = P.slots[oi];
      const kt = `${L.teacher_id}|${s.day}|${s.period}`, kc = `${L.class_id}|${s.day}|${s.period}`;
      if (tSlot.has(kt)) hard++; tSlot.set(kt, i);
      if (cSlot.has(kc)) hard++; cSlot.set(kc, i);
      if (P.unT.has(`${L.teacher_id}|${s.day}|${s.period}`)) hard++;
      if (P.unC.has(`${L.class_id}|${s.day}|${s.period}`)) hard++;
      const kd = `${L.teacher_id}|${s.day}`; if (!tDayPeriods.has(kd)) tDayPeriods.set(kd, []); tDayPeriods.get(kd)!.push(s.period);
      if (L.prefer_pagi && s.period >= 7) soft += P.w.sore;
    }
    const sd = P.slots[assign[i]].day;
    tDay.set(`${L.teacher_id}|${sd}`, (tDay.get(`${L.teacher_id}|${sd}`) || 0) + L.size);
    aDay.set(`${L.assignment_id}|${sd}`, (aDay.get(`${L.assignment_id}|${sd}`) || 0) + L.size);
  });
  for (const [k, n] of tDay) { const mx = P.teachers.get(+k.split("|")[0])?.max_jp_day || 0; if (mx && n > mx) hard += n - mx; }
  for (const [k, n] of aDay) { const mx = P.aMaxDay.get(+k.split("|")[0]) || 0; if (mx && n > mx) hard += n - mx; }
  for (const [, ps] of tDayPeriods) { const u = [...new Set(ps)].sort((a, b) => a - b); let gap = 0; for (let j = 1; j < u.length; j++) gap += Math.max(0, u[j] - u[j - 1] - 1); soft += gap * P.w.gap; }
  // sebaran: mapel yang menumpuk >2x sehari selain max harian diberi penalti lembut
  for (const [, n] of aDay) if (n > 2) soft += (n - 2) * P.w.sebar;
  return { hard, soft };
}
const score = (a: number[], P: P) => { const e = evaluate(a, P); return 10000 * e.hard + e.soft; };

// ---------- CP: backtracking MRV + forward checking ----------
export function solveCP(P: P, deadline: number): number[] | null {
  const n = P.units.length;
  const assign = new Array(n).fill(-1);
  const tUsed = new Set<string>(), cUsed = new Set<string>();
  const tDay = new Map<string, number>(), aDay = new Map<string, number>();
  const occOf = (i: number, s: number): number[] => P.units[i].size === 2 ? [s, P.pairOf.get(s) ?? s] : [s];
  const okSlot = (i: number, s: number): boolean => {
    const L = P.units[i], sl = P.slots[s];
    for (const oi of occOf(i, s)) { const o = P.slots[oi];
      if (tUsed.has(`${L.teacher_id}|${o.day}|${o.period}`) || cUsed.has(`${L.class_id}|${o.day}|${o.period}`)) return false;
      if (P.unT.has(`${L.teacher_id}|${o.day}|${o.period}`) || P.unC.has(`${L.class_id}|${o.day}|${o.period}`)) return false; }
    const mxT = P.teachers.get(L.teacher_id)?.max_jp_day || 0; if (mxT && (tDay.get(`${L.teacher_id}|${sl.day}`) || 0) + L.size > mxT) return false;
    const mxA = P.aMaxDay.get(L.assignment_id) || 0; if (mxA && (aDay.get(`${L.assignment_id}|${sl.day}`) || 0) + L.size > mxA) return false;
    return true;
  };
  // urutan lesson: yang domain-nya paling sempit dulu (MRV statis)
  const domains = P.units.map((_, i) => P.unitSlots[i].filter(s => okSlot(i, s)).length);
  // unit blok 2JP lebih dulu (paling kaku), lalu domain tersempit (MRV)
  const order = [...Array(n).keys()].sort((a, b) => (P.units[b].size - P.units[a].size) || domains[a] - domains[b]);
  let nodes = 0;
  const bt = (pos: number): boolean => {
    if (pos === n) return true;
    if ((++nodes & 1023) === 0 && Date.now() > deadline) return false;
    const i = order[pos];
    // kandidat slot diacak ringan berdasarkan preferensi pagi agar hasil menyebar
    const cand = P.unitSlots[i].filter(s => okSlot(i, s));
    cand.sort((a, b) => (P.units[i].prefer_pagi ? P.slots[a].period - P.slots[b].period : 0) || ((a * 7919 + i * 104729) % 97) - ((b * 7919 + i * 104729) % 97));
    for (const s of cand) {
      const L = P.units[i], sl = P.slots[s], occ = occOf(i, s);
      assign[i] = s; for (const oi of occ) { const o = P.slots[oi]; tUsed.add(`${L.teacher_id}|${o.day}|${o.period}`); cUsed.add(`${L.class_id}|${o.day}|${o.period}`); }
      tDay.set(`${L.teacher_id}|${sl.day}`, (tDay.get(`${L.teacher_id}|${sl.day}`) || 0) + L.size);
      aDay.set(`${L.assignment_id}|${sl.day}`, (aDay.get(`${L.assignment_id}|${sl.day}`) || 0) + L.size);
      if (bt(pos + 1)) return true;
      assign[i] = -1; for (const oi of occ) { const o = P.slots[oi]; tUsed.delete(`${L.teacher_id}|${o.day}|${o.period}`); cUsed.delete(`${L.class_id}|${o.day}|${o.period}`); }
      tDay.set(`${L.teacher_id}|${sl.day}`, (tDay.get(`${L.teacher_id}|${sl.day}`) || 0) - L.size);
      aDay.set(`${L.assignment_id}|${sl.day}`, (aDay.get(`${L.assignment_id}|${sl.day}`) || 0) - L.size);
      if (Date.now() > deadline) return false;
    }
    return false;
  };
  return bt(0) ? assign : null;
}

// ---------- heuristik bersama (GA & Tabu) ----------
const randCand = (P: P, i: number) => P.unitSlots[i][Math.floor(Math.random() * P.unitSlots[i].length)];
function greedy(P: P): number[] {
  const a = P.units.map((_, i) => randCand(P, i));
  return improve(a, P, 400);
}
function improve(a: number[], P: P, rounds: number): number[] {
  let best = [...a], bs = score(best, P);
  for (let r = 0; r < rounds && bs > 0; r++) {
    let improved = false;
    for (let i = 0; i < a.length; i++) {
      for (const s of P.unitSlots[i]) {
        if (best[i] === s) continue;
        const trial = [...best]; trial[i] = s; const sc = score(trial, P);
        if (sc < bs) { best = trial; bs = sc; improved = true; }
      }
    }
    if (!improved) break;
  }
  return best;
}
export function solveGA(P: P, deadline: number): number[] {
  let pop = Array.from({ length: 24 }, () => greedy(P));
  pop.sort((x, y) => score(x, P) - score(y, P));
  while (Date.now() < deadline && score(pop[0], P) > 0) {
    const parents = pop.slice(0, 8);
    const kids: number[][] = [];
    while (kids.length < 16) {
      const p1 = parents[Math.floor(Math.random() * parents.length)], p2 = parents[Math.floor(Math.random() * parents.length)];
      const cut = Math.floor(Math.random() * P.units.length);
      const kid = p1.map((v, i) => (i < cut ? v : p2[i]));
      for (let k = 0; k < 3; k++) if (Math.random() < 0.4) { const j = Math.floor(Math.random() * kid.length); kid[j] = randCand(P, j); }
      kids.push(improve(kid, P, 60)); // memetic: local search pada anak
    }
    pop = [...pop.slice(0, 6), ...kids].sort((x, y) => score(x, P) - score(y, P)).slice(0, 24);
  }
  return pop[0];
}
export function solveTabu(P: P, deadline: number): number[] {
  let cur = greedy(P), cs = score(cur, P); let best = [...cur], bs = cs;
  const tabu = new Map<string, number>(); let iter = 0;
  while (Date.now() < deadline && bs > 0) {
    iter++; let moveBest: number[] | null = null, ms = Infinity, mkey = "";
    for (let t = 0; t < 60; t++) {
      const i = Math.floor(Math.random() * cur.length);
      const trial = [...cur];
      if (Math.random() < 0.6) trial[i] = randCand(P, i);
      else { const j = Math.floor(Math.random() * cur.length); // tukar hanya bila tetap di kandidat masing-masing unit
        if (P.unitSlots[i].includes(trial[j]) && P.unitSlots[j].includes(trial[i])) [trial[i], trial[j]] = [trial[j], trial[i]]; else trial[i] = randCand(P, i); }
      const sc = score(trial, P), key = `${i}:${trial[i]}`;
      if ((tabu.get(key) || 0) > iter && sc >= bs) continue;
      if (sc < ms) { ms = sc; moveBest = trial; mkey = key; }
    }
    if (!moveBest) break;
    cur = moveBest; cs = ms; tabu.set(mkey, iter + 12);
    if (cs < bs) { bs = cs; best = [...cur]; }
  }
  return improve(best, P, 300);
}

export function runSolver(model: "cp" | "ga" | "tabu", timeoutSec: number) {
  const P = loadProblem();
  const t0 = Date.now(); const deadline = t0 + timeoutSec * 1000;
  const sol = model === "cp" ? solveCP(P, deadline) : model === "ga" ? solveGA(P, deadline) : solveTabu(P, deadline);
  const seconds = (Date.now() - t0) / 1000;
  if (!sol) return { model, ok: false, hard: -1, soft: 0, seconds, note: "Tidak ditemukan solusi layak dalam batas waktu (CP berhenti sebelum lengkap)." };
  const e = evaluate(sol, P);
  return { model, ok: true, hard: e.hard, soft: e.soft, seconds, sol, note: e.hard === 0 ? "Valid (0 hard violation)" : `Masih ada ${e.hard} hard violation` };
}
export function applySolution(sol: number[]) {
  const P = loadProblem();
  tx(() => {
    db.prepare("DELETE FROM entries").run();
    const ins = db.prepare("INSERT INTO entries(assignment_id,day,period) VALUES(?,?,?)");
    sol.forEach((s, i) => { const u = P.units[i];
      ins.run(u.assignment_id, P.slots[s].day, P.slots[s].period);
      if (u.size === 2) { const o = P.slots[P.pairOf.get(s) ?? s]; ins.run(u.assignment_id, o.day, o.period); } });
    db.prepare("DELETE FROM move_requests WHERE status='pending'").run();
  });
}
