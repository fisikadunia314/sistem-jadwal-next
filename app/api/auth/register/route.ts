import { NextRequest, NextResponse } from "next/server";
import db, { hashPassword } from "@/lib/db";
import { makeToken } from "@/lib/auth";
export async function POST(req: NextRequest) {
  const { display_name, username, password } = await req.json();
  if (!display_name || String(username || "").trim().length < 3 || String(password || "").length < 6)
    return NextResponse.json({ ok: false, error: "Nama wajib, username min 3, password min 6 karakter." }, { status: 400 });
  try {
    const info = db.prepare("INSERT INTO users(username,password_hash,display_name,role) VALUES(?,?,?,'pegawai')")
      .run(String(username).trim(), hashPassword(String(password)), String(display_name).trim());
    const u: any = db.prepare("SELECT * FROM users WHERE id=?").get(info.lastInsertRowid);
    const res = NextResponse.json({ ok: true, user: { id: u.id, name: u.display_name, role: u.role } });
    res.cookies.set("sid", makeToken(u), { httpOnly: true, path: "/", maxAge: 7 * 86400, sameSite: "lax" });
    return res;
  } catch { return NextResponse.json({ ok: false, error: "Username sudah dipakai." }, { status: 409 }); }
}
