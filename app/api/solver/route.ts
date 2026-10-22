import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import db from "@/lib/db";
import { runSolver, applySolution } from "@/lib/solver";
import { solveCpSat } from "@/lib/cpsat";
export const dynamic = "force-dynamic";
export async function GET() {
  const u = await currentUser(); if (!u || u.role !== "admin") return NextResponse.json({ ok: false, error: "Khusus Superadmin." }, { status: 403 });
  return NextResponse.json({ ok: true, runs: db.prepare("SELECT * FROM runs ORDER BY id DESC LIMIT 20").all() });
}
export async function POST(req: NextRequest) {
  const u = await currentUser(); if (!u || u.role !== "admin") return NextResponse.json({ ok: false, error: "Khusus Superadmin." }, { status: 403 });
  const b = await req.json();
  const timeout = Math.min(60, Math.max(2, Number(b.timeout) || 10));
  const models = b.model === "adu" ? (["cp", "ga", "tabu"] as const) : ([b.model || "cp"] as const);
  const results: any[] = []; let best: any = null; const diagnoses: string[] = [];
  for (const m of models) {
    if (m === "cp") {
      const cs = await solveCpSat(timeout);
      if (cs.kind === "ok") {
        const r: any = { model: "cp", sol: cs.sol, ok: cs.hard === 0, hard: cs.hard, soft: cs.soft, seconds: cs.seconds, note: `OR-Tools CP-SAT ${cs.status}` };
        db.prepare("INSERT INTO runs(model,hard,soft,seconds,note,created_at) VALUES(?,?,?,?,?,datetime('now','localtime'))").run("cp", r.hard, r.soft, r.seconds, r.note);
        results.push({ model: "cp", ok: r.ok, hard: r.hard, soft: r.soft, seconds: Math.round(r.seconds * 100) / 100, note: r.note });
        if (r.ok && (!best || r.soft < best.soft)) best = r;
      } else if (cs.kind === "infeasible") {
        diagnoses.push(...cs.reasons);
        db.prepare("INSERT INTO runs(model,hard,soft,seconds,note,created_at) VALUES(?,?,?,?,?,datetime('now','localtime'))").run("cp", -2, 0, cs.seconds, "INFEASIBLE: " + cs.reasons[0].slice(0, 120));
        results.push({ model: "cp", ok: false, hard: -2, soft: 0, seconds: Math.round(cs.seconds * 100) / 100, note: "Data/aturan terbukti mustahil (INFEASIBLE) — lihat diagnosis di bawah." });
      } else {
        diagnoses.push(cs.error);
        db.prepare("INSERT INTO runs(model,hard,soft,seconds,note,created_at) VALUES(?,?,?,?,?,datetime('now','localtime'))").run("cp", -3, 0, cs.seconds, cs.error.slice(0, 120));
        results.push({ model: "cp", ok: false, hard: -3, soft: 0, seconds: Math.round(cs.seconds * 100) / 100, note: cs.kind === "unavailable" ? "OR-Tools CP-SAT belum tersedia — lihat diagnosis di bawah." : cs.error.slice(0, 120) });
      }
      continue;
    }
    const r: any = runSolver(m, timeout);
    db.prepare("INSERT INTO runs(model,hard,soft,seconds,note,created_at) VALUES(?,?,?,?,?,datetime('now','localtime'))").run(m, r.hard, r.soft, r.seconds, r.note);
    results.push({ model: m, ok: r.ok, hard: r.hard, soft: r.soft, seconds: Math.round(r.seconds * 100) / 100, note: r.note });
    if (r.ok && r.hard === 0 && (!best || r.soft < best.soft)) best = r;
  }
  let applied = false;
  if (best && b.apply) { applySolution(best.sol); applied = true; }
  return NextResponse.json({ ok: true, results, applied, diagnoses, best_model: best?.model || null,
    message: applied ? `Hasil terbaik (${best.model.toUpperCase()}, soft ${best.soft}) diterapkan ke papan.` : best ? `Ada hasil valid dari ${best.model.toUpperCase()} — centang "terapkan" untuk memakainya.` : "Belum ada hasil 0 hard violation. Periksa data/Aturan." });
}
