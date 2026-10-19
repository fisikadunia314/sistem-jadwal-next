import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getSettings, setSetting, DEFAULT_SETTINGS } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  const u = await currentUser(); if (!u) return NextResponse.json({ ok: false, error: "Login dulu." }, { status: 401 });
  return NextResponse.json({ ok: true, settings: getSettings(), is_admin: u.role === "admin" });
}
export async function POST(req: NextRequest) {
  const u = await currentUser(); if (!u || u.role !== "admin") return NextResponse.json({ ok: false, error: "Khusus Superadmin." }, { status: 403 });
  const b = await req.json();
  for (const k of Object.keys(DEFAULT_SETTINGS)) if (b[k] !== undefined) setSetting(k, String(b[k]));
  return NextResponse.json({ ok: true, settings: getSettings(), message: "Aturan tersimpan." });
}
