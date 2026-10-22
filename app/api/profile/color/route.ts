import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import db from "@/lib/db";
import { randomTeacherColor, textColorFor, validateTeacherColor } from "@/lib/teacher-colors";
export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ ok: false, error: "Sesi berakhir, login ulang." }, { status: 401 });
  if (!u.teacher_id) return NextResponse.json({ ok: false, error: "Akun ini belum terhubung ke data guru, jadi belum punya warna papan." }, { status: 400 });
  const b = await req.json().catch(() => ({}));
  let color: string;
  if (b.random) {
    color = randomTeacherColor(u.teacher_id);
  } else {
    const v = validateTeacherColor(b.color_hex, u.teacher_id);
    if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 409 });
    color = v.color;
  }
  const info: any = db.prepare("UPDATE teachers SET color_hex=? WHERE id=?").run(color, u.teacher_id);
  if (!info.changes) return NextResponse.json({ ok: false, error: "Data guru tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ ok: true, color_hex: color, text_color: textColorFor(color), message: `Warna guru tersimpan: ${color}. Warna teks otomatis ${textColorFor(color)}.` });
}
