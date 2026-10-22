// Jembatan ke OR-Tools CP-SAT (Google) lewat proses Python terpisah.
// CP-SAT adalah solver constraint beneran (bukan heuristik): bila mengembalikan FEASIBLE/OPTIMAL,
// seluruh batasan keras dijamin terpenuhi; bila INFEASIBLE, data/aturan terbukti mustahil dipenuhi semua.
import { spawn } from "child_process";
import path from "path";
import { loadProblem, evaluate, polishSolution } from "./solver";

export type CpSatResult =
  | { kind: "ok"; sol: number[]; hard: number; soft: number; seconds: number; status: string }
  | { kind: "infeasible"; seconds: number; reasons: string[] }
  | { kind: "unavailable"; seconds: number; error: string }
  | { kind: "error"; seconds: number; error: string };

function preflight(P: ReturnType<typeof loadProblem>): { reasons: string[]; cand: number[][] } {
  const reasons: string[] = [];
  const cand = P.units.map((u, i) => P.unitSlots[i].filter(s => {
    const occ = u.size === 2 ? [s, P.pairOf.get(s) ?? s] : [s];
    return occ.every(oi => { const sl = P.slots[oi]; return !P.unT.has(`${u.teacher_id}|${sl.day}|${sl.period}`) && !P.unC.has(`${u.class_id}|${sl.day}|${sl.period}`); });
  }));
  cand.forEach((c, i) => { if (!c.length) reasons.push(`Unit penugasan #${P.units[i].assignment_id} (guru ${P.units[i].teacher_id}, kelas ${P.units[i].class_id}) tidak punya satu pun slot kosong yang sah — semua terlarang oleh ketidaktersediaan.`); });
  const tot = (key: "teacher_id" | "class_id", label: string) => {
    const m = new Map<number, number>();
    P.units.forEach(u => m.set(u[key], (m.get(u[key]) || 0) + u.size));
    for (const [id, n] of m) if (n > P.slots.length) reasons.push(`${label} ${id} totalnya ${n} JP/minggu, melebihi ${P.slots.length} JP yang tersedia dalam seminggu.`);
  };
  tot("teacher_id", "Guru"); tot("class_id", "Kelas");
  const aTot = new Map<number, number>();
  P.units.forEach(u => aTot.set(u.assignment_id, (aTot.get(u.assignment_id) || 0) + u.size));
  const nDays = new Set(P.slots.map(s => s.day)).size;
  for (const [aid, n] of aTot) { const mx = P.aMaxDay.get(aid) || 0; if (mx && n > mx * nDays) reasons.push(`Penugasan #${aid} total ${n} JP tetapi batas hariannya ${mx} JP x ${nDays} hari = ${mx * nDays} JP. Turunkan total atau naikkan batas harian.`); }
  return { reasons, cand };
}

export async function solveCpSat(timeoutSec: number): Promise<CpSatResult> {
  const t0 = Date.now();
  const P = loadProblem();
  const { reasons, cand } = preflight(P);
  if (reasons.length) return { kind: "infeasible", seconds: (Date.now() - t0) / 1000, reasons };
  if (!P.units.length) return { kind: "error", seconds: 0, error: "Belum ada penugasan." };
  const payload = {
    time_limit: timeoutSec,
    weights: P.w,
    slots: P.slots,
    pair: Object.fromEntries(P.pairOf),
    units: P.units.map((u, i) => ({ assignment_id: u.assignment_id, teacher_id: u.teacher_id, class_id: u.class_id, size: u.size, prefer_pagi: u.prefer_pagi, candidates: cand[i] })),
    teacher_max_day: Object.fromEntries([...P.teachers].map(([id, t]) => [id, t.max_jp_day || 0])),
    assignment_max_day: Object.fromEntries([...P.aMaxDay]),
  };
  const script = path.join(process.cwd(), "solver", "cpsat_solver.py");
  const cmds = process.env.CPSAT_PYTHON ? [process.env.CPSAT_PYTHON] : (process.platform === "win32" ? ["py", "python", "python3"] : ["python3", "python"]);
  let lastErr = "";
  for (const cmd of cmds) {
    try {
      const out = await new Promise<string>((resolve, reject) => {
        const ch = spawn(cmd, [script], { cwd: process.cwd() });
        let stdout = "", stderr = "";
        const killer = setTimeout(() => { ch.kill(); reject(new Error("timeout proses")); }, (timeoutSec + 15) * 1000);
        ch.stdout.on("data", d => stdout += d); ch.stderr.on("data", d => stderr += d);
        ch.on("error", e => { clearTimeout(killer); reject(e); });
        ch.on("close", code => { clearTimeout(killer); if (code === 0) resolve(stdout); else reject(new Error(stderr.trim() || `exit ${code}`)); });
        ch.stdin.write(JSON.stringify(payload)); ch.stdin.end();
      });
      const parsed = JSON.parse(out.trim().split("\n").pop()!);
      const seconds = (Date.now() - t0) / 1000;
      if (parsed.status === "INFEASIBLE") return { kind: "infeasible", seconds, reasons: ["CP-SAT membuktikan TIDAK ADA jadwal yang memenuhi semua batasan keras sekaligus. Longgarkan salah satu: ketidaktersediaan, batas JP harian, atau total JP penugasan."] };
      if ((parsed.status === "OPTIMAL" || parsed.status === "FEASIBLE") && parsed.assign.every((v: number) => v >= 0)) {
        const sol = polishSolution(P, parsed.assign, 1500);
        const ev = evaluate(sol, P);
        return { kind: "ok", sol, hard: ev.hard, soft: ev.soft, seconds: (Date.now() - t0) / 1000, status: parsed.status };
      }
      return { kind: "error", seconds, error: `CP-SAT berhenti dengan status ${parsed.status} (waktu habis sebelum menemukan solusi). Naikkan batas waktu, atau longgarkan aturan agar ruang cari mengecil.` };
    } catch (e: any) {
      lastErr = String(e?.message || e);
      if (/No module named 'ortools'|ModuleNotFoundError/i.test(lastErr)) return { kind: "unavailable", seconds: (Date.now() - t0) / 1000, error: "Library OR-Tools belum terpasang di Python komputer ini. Jalankan: pip install ortools (lihat README), lalu coba lagi." };
      if (/ENOENT|not found|No such file/i.test(lastErr)) continue;
      return { kind: "error", seconds: (Date.now() - t0) / 1000, error: lastErr.slice(0, 300) };
    }
  }
  return { kind: "unavailable", seconds: (Date.now() - t0) / 1000, error: "Python tidak ditemukan di komputer ini. Pasang Python 3 lalu jalankan: pip install ortools (lihat README). Di Windows, Python dapat dipasang dari python.org dan centang 'Add python.exe to PATH'." };
}
