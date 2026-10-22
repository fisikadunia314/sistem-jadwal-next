import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { randomTeacherColor, textColorFor } from "@/lib/teacher-colors";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const u = await currentUser();
  if (!u || u.role !== "admin") return NextResponse.json({ ok: false, error: "Khusus Superadmin." }, { status: 403 });
  const excludeId = Number(req.nextUrl.searchParams.get("excludeId")) || null;
  const color_hex = randomTeacherColor(excludeId);
  return NextResponse.json({ ok: true, color_hex, text_color: textColorFor(color_hex) });
}
