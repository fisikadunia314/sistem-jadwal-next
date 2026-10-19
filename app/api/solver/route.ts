import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import db from "@/lib/db";
import { runSolver, applySolution, evaluate, loadProblem } from "@/lib/solver";
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
  const results: any[] = []; let best: any = null;
  for (const m of models) {
    const r: any = runSolver(m, timeout);
    db.prepare("INSERT INTO runs(model,hard,soft,seconds,note,created_at) VALUES(?,?,?,?,?,datetime('now','localtime'))").run(m, r.hard, r.soft, r.seconds, r.note);
    results.push({ model: m, ok: r.ok, hard: r.hard, soft: r.soft, seconds: Math.round(r.seconds * 100) / 100, note: r.note });
    if (r.ok && r.hard === 0 && (!best || r.soft < best.soft)) best = r;
  }
  let applied = false;
  if (best && b.apply) { applySolution(best.sol); applied = true; }
  return NextResponse.json({ ok: true, results, applied, best_model: best?.model || null,
    message: applied ? `Hasil terbaik (${best.model.toUpperCase()}, soft ${best.soft}) diterapkan ke papan.` : best ? `Ada hasil valid dari ${best.model.toUpperCase()} — centang "terapkan" untuk memakainya.` : "Belum ada hasil 0 hard violation. Periksa data/Aturan." });
}
