import { NextRequest, NextResponse } from "next/server";
import db, { verifyPassword } from "@/lib/db";
import { makeToken } from "@/lib/auth";
export async function POST(req: NextRequest) {
  const { username, password } = await req.json();
  const u: any = db.prepare("SELECT * FROM users WHERE username=?").get(String(username || "").trim());
  if (!u || !verifyPassword(String(password || ""), u.password_hash))
    return NextResponse.json({ ok: false, error: "Username / password salah." }, { status: 401 });
  const res = NextResponse.json({ ok: true, user: { id: u.id, name: u.display_name, role: u.role } });
  res.cookies.set("sid", makeToken(u), { httpOnly: true, path: "/", maxAge: 7 * 86400, sameSite: "lax" });
  return res;
}
