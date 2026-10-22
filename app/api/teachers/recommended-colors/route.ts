import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { recommendedTeacherColors, usedTeacherColors } from "@/lib/teacher-colors";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ ok: false, error: "Login dulu." }, { status: 401 });
  const requested = Number(req.nextUrl.searchParams.get("excludeId")) || null;
  if (u.role !== "admin" && requested && requested !== u.teacher_id)
    return NextResponse.json({ ok: false, error: "Hanya boleh melihat rekomendasi untuk warna Anda sendiri." }, { status: 403 });
  const excludeId = u.role === "admin" ? requested : u.teacher_id;
  if (!excludeId && u.role !== "admin") return NextResponse.json({ ok: false, error: "Akun belum terhubung ke data guru." }, { status: 400 });
  const seed = Number(req.nextUrl.searchParams.get("seed")) || 0;
  return NextResponse.json({ ok: true, colors: recommendedTeacherColors(excludeId, 14, seed), used: usedTeacherColors(excludeId) });
}
