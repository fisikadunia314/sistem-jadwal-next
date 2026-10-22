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

// ---------- Mesin DELTA (optimasi kecepatan) ----------
// Cara lama: setiap calon langkah dinilai dengan evaluate() PENUH (membangun ulang Map/Set string
// untuk seluruh jadwal) -> sangat lambat. Mesin ini memelihara cacah (count) guru/kelas/hari dalam
// array angka; menilai satu langkah hanya menghitung bagian yang berubah (slot lama/baru, hari guru,
// hari penugasan). Hasil akhirnya tetap diverifikasi evaluate() penuh sebelum diterapkan.
type Enc = { tIdx: Map<number, number>; cIdx: Map<number, number>; aIdx: Map<number, number>; dIdx: Map<string, number>; nT: number; nC: number; nA: number; nD: number; nS: number };
const encCache = new WeakMap<object, Enc>();
function enc(P: P): Enc {
  let e = encCache.get(P); if (e) return e;
  const uniq = <T,>(xs: T[]): T[] => [...new Set(xs)];
  const T = uniq(P.units.map(u => u.teacher_id)), C = uniq(P.units.map(u => u.class_id)), A = uniq(P.units.map(u => u.assignment_id)), D = uniq(P.slots.map(s => s.day));
  e = { tIdx: new Map(T.map((v, i) => [v, i])), cIdx: new Map(C.map((v, i) => [v, i])), aIdx: new Map(A.map((v, i) => [v, i])), dIdx: new Map(D.map((v, i) => [v, i])), nT: T.length, nC: C.length, nA: A.length, nD: D.length, nS: P.slots.length };
  encCache.set(P, e); return e;
}
const occOfIdx = (P: P, i: number, s: number): number[] => P.units[i].size === 2 ? [s, P.pairOf.get(s) ?? s] : [s];
type State = { assign: number[]; hard: number; soft: number; tSlot: Int32Array; cSlot: Int32Array; tDay: Int32Array; aDay: Int32Array };
function makeState(P: P, assign: number[]): State {
  const E = enc(P), ev = evaluate(assign, P);
  const st: State = { assign: [...assign], hard: ev.hard, soft: ev.soft, tSlot: new Int32Array(E.nT * E.nS), cSlot: new Int32Array(E.nC * E.nS), tDay: new Int32Array(E.nT * E.nD), aDay: new Int32Array(E.nA * E.nD) };
  P.units.forEach((u, i) => {
    const t = E.tIdx.get(u.teacher_id)!, c = E.cIdx.get(u.class_id)!, a = E.aIdx.get(u.assignment_id)!, d = E.dIdx.get(P.slots[assign[i]].day)!;
    for (const oi of occOfIdx(P, i, assign[i])) { st.tSlot[t * E.nS + oi]++; st.cSlot[c * E.nS + oi]++; }
    st.tDay[t * E.nD + d] += u.size; st.aDay[a * E.nD + d] += u.size;
  });
  return st;
}
function applyCounts(P: P, st: State, i: number, from: number, to: number) {
  const E = enc(P), u = P.units[i], t = E.tIdx.get(u.teacher_id)!, c = E.cIdx.get(u.class_id)!, a = E.aIdx.get(u.assignment_id)!;
  if (from >= 0) { const d = E.dIdx.get(P.slots[from].day)!; for (const oi of occOfIdx(P, i, from)) { st.tSlot[t * E.nS + oi]--; st.cSlot[c * E.nS + oi]--; } st.tDay[t * E.nD + d] -= u.size; st.aDay[a * E.nD + d] -= u.size; }
  if (to >= 0) { const d = E.dIdx.get(P.slots[to].day)!; for (const oi of occOfIdx(P, i, to)) { st.tSlot[t * E.nS + oi]++; st.cSlot[c * E.nS + oi]++; } st.tDay[t * E.nD + d] += u.size; st.aDay[a * E.nD + d] += u.size; }
  st.assign[i] = to;
}
// biaya lokal untuk ruang lingkup yang disentuh unit i (dipakai sebelum & sesudah mutasi percobaan)
function scopeCost(P: P, st: State, i: number, days: Set<number>, slots: Set<number>): { hard: number; soft: number } {
  const E = enc(P), u = P.units[i], t = E.tIdx.get(u.teacher_id)!, c = E.cIdx.get(u.class_id)!, a = E.aIdx.get(u.assignment_id)!;
  let hard = 0, soft = 0;
  for (const s of slots) { hard += Math.max(0, st.tSlot[t * E.nS + s] - 1) + Math.max(0, st.cSlot[c * E.nS + s] - 1); }
  const cur = st.assign[i];
  if (cur >= 0) for (const oi of occOfIdx(P, i, cur)) { const s = P.slots[oi]; if (P.unT.has(`${u.teacher_id}|${s.day}|${s.period}`) || P.unC.has(`${u.class_id}|${s.day}|${s.period}`)) hard++; if (u.prefer_pagi && s.period >= 7) soft += P.w.sore; }
  const mxT = P.teachers.get(u.teacher_id)?.max_jp_day || 0, mxA = P.aMaxDay.get(u.assignment_id) || 0;
  for (const d of days) {
    if (mxT) hard += Math.max(0, st.tDay[t * E.nD + d] - mxT);
    if (mxA) hard += Math.max(0, st.aDay[a * E.nD + d] - mxA);
    // celah guru pada hari d (dihitung dari penempatan saat ini)
    const ps = new Set<number>();
    P.units.forEach((x, xi) => { if (x.teacher_id === u.teacher_id && st.assign[xi] >= 0 && E.dIdx.get(P.slots[st.assign[xi]].day) === d) for (const oi of occOfIdx(P, xi, st.assign[xi])) ps.add(P.slots[oi].period); });
    const sorted = [...ps].sort((x, y) => x - y); let gap = 0; for (let k = 1; k < sorted.length; k++) gap += Math.max(0, sorted[k] - sorted[k - 1] - 1); soft += gap * P.w.gap;
    soft += Math.max(0, st.aDay[a * E.nD + d] - 2) * P.w.sebar;
  }
  return { hard, soft };
}
// coba pindahkan unit i; kembalikan perubahan (hard,soft). State DITINGGALKAN berubah — panggil rollback bila tidak dipakai.
function trialMove(P: P, st: State, i: number, target: number): { dh: number; ds: number; from: number } {
  const E = enc(P), from = st.assign[i];
  const days = new Set<number>([E.dIdx.get(P.slots[from].day)!, E.dIdx.get(P.slots[target].day)!]);
  const slots = new Set<number>([...occOfIdx(P, i, from), ...occOfIdx(P, i, target)]);
  const before = scopeCost(P, st, i, days, slots);
  applyCounts(P, st, i, from, target);
  const after = scopeCost(P, st, i, days, slots);
  return { dh: after.hard - before.hard, ds: after.soft - before.soft, from };
}
function commitDelta(st: State, d: { dh: number; ds: number }) { st.hard += d.dh; st.soft += d.ds; }
const stateScore = (st: State) => 10000 * st.hard + st.soft;

function improveFast(P: P, start: number[], deadline: number, maxRounds: number): number[] {
  const st = makeState(P, start);
  for (let round = 0; round < maxRounds && stateScore(st) > 0; round++) {
    let improved = false;
    for (let i = 0; i < P.units.length; i++) {
      if ((i & 7) === 0 && Date.now() > deadline) return st.assign;
      const cur = st.assign[i]; let bestS = cur, bestD: { dh: number; ds: number } | null = null, bestDelta = 0;
      for (const cand of P.unitSlots[i]) {
        if (cand === cur) continue;
        const d = trialMove(P, st, i, cand);
        const delta = 10000 * d.dh + d.ds;
        applyCounts(P, st, i, cand, cur); // rollback percobaan
        if (delta < bestDelta) { bestDelta = delta; bestS = cand; bestD = d; }
      }
      if (bestD && bestS !== cur) {
        const d = trialMove(P, st, i, bestS); commitDelta(st, d); improved = true;
        if (stateScore(st) <= 0) break;
      }
    }
    if (!improved) break;
  }
  return st.assign;
}
const randCand = (P: P, i: number) => P.unitSlots[i][Math.floor(Math.random() * P.unitSlots[i].length)];
function randomAssign(P: P): number[] { return P.units.map((_, i) => randCand(P, i)); }

// ---------- GA Memetic (delta) ----------
export function solveGA(P: P, deadline: number): number[] {
  const POP = 16;
  let pop = Array.from({ length: POP }, () => improveFast(P, randomAssign(P), Math.min(deadline, Date.now() + 1500), 40));
  const sc = (a: number[]) => { const e = evaluate(a, P); return 10000 * e.hard + e.soft; };
  pop.sort((x, y) => sc(x) - sc(y));
  while (Date.now() < deadline && sc(pop[0]) > 0) {
    const parents = pop.slice(0, 6); const kids: number[][] = [];
    while (kids.length < 10 && Date.now() < deadline) {
      const p1 = parents[Math.floor(Math.random() * parents.length)], p2 = parents[Math.floor(Math.random() * parents.length)];
      const cut = Math.floor(Math.random() * P.units.length);
      const kid = p1.map((v, i) => (i < cut ? v : p2[i]));
      for (let k = 0; k < 3; k++) if (Math.random() < 0.4) { const j = Math.floor(Math.random() * kid.length); kid[j] = randCand(P, j); }
      kids.push(improveFast(P, kid, deadline, 25));
    }
    pop = [...pop.slice(0, 5), ...kids].sort((x, y) => sc(x) - sc(y)).slice(0, POP);
  }
  return pop[0];
}

// ---------- Tabu Search (delta) ----------
export function solveTabu(P: P, deadline: number): number[] {
  const st = makeState(P, improveFast(P, randomAssign(P), Math.min(deadline, Date.now() + 1500), 40));
  let best = [...st.assign], bs = stateScore(st);
  const tabu = new Map<string, number>(); let iter = 0;
  while (Date.now() < deadline && bs > 0) {
    iter++;
    let chosen: { i: number; s: number; d: { dh: number; ds: number; from: number } } | null = null; let chosenDelta = Infinity;
    for (let t = 0; t < 48; t++) {
      const i = Math.floor(Math.random() * P.units.length); const target = randCand(P, i);
      if (target === st.assign[i]) continue;
      const d = trialMove(P, st, i, target); const delta = 10000 * d.dh + d.ds;
      applyCounts(P, st, i, target, d.from);
      const key = `${i}:${target}`, isTabu = (tabu.get(key) || 0) > iter;
      const newScore = stateScore(st) + delta;
      if (isTabu && newScore >= bs) continue;
      if (delta < chosenDelta) { chosenDelta = delta; chosen = { i, s: target, d }; }
    }
    if (!chosen) break;
    const d = trialMove(P, st, chosen.i, chosen.s); commitDelta(st, d);
    tabu.set(`${chosen.i}:${chosen.s}`, iter + 12);
    const cur = stateScore(st);
    if (cur < bs) { bs = cur; best = [...st.assign]; }
  }
  return improveFast(P, best, deadline, 120);
}

export function polishSolution(P: P, sol: number[], ms: number): number[] {
  return improveFast(P, sol, Date.now() + ms, 200);
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
