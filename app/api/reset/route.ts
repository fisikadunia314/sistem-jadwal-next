import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { resetData, ringkasan, SCOPES, type Scope } from "@/lib/reset";

export const dynamic = "force-dynamic";

export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ ok: false, error: "Login dulu." }, { status: 401 });
  return NextResponse.json({
    ok: true,
    is_admin: u.role === "admin",
    counts: ringkasan(),
    scopes: Object.entries(SCOPES).map(([id, v]) => ({ id, ...v })),
  });
}

export async function POST(req: NextRequest) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ ok: false, error: "Login dulu." }, { status: 401 });
  if (u.role !== "admin") return NextResponse.json({ ok: false, error: "Khusus Superadmin." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const scope = String(body.scope || "") as Scope;
  const cfg = SCOPES[scope];
  if (!cfg) return NextResponse.json({ ok: false, error: "Jenis reset tidak dikenal." }, { status: 400 });

  // Kata konfirmasi sengaja diketik ulang supaya tidak terklik tanpa sadar
  // (pengganti confirm() bawaan browser yang di proyek ini tidak dipakai).
  if (String(body.konfirmasi || "").trim().toUpperCase() !== cfg.kata)
    return NextResponse.json({ ok: false, error: `Ketik ${cfg.kata} untuk mengonfirmasi.` }, { status: 400 });

  const hasil = resetData(scope, Number(u.id));
  return NextResponse.json({ ...hasil, scope });
}
