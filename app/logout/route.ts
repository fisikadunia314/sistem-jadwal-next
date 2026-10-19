import { NextResponse } from "next/server";
export async function GET(req: Request) {
  const r = NextResponse.redirect(new URL("/login", req.url)); r.cookies.delete("sid"); return r;
}
export async function POST(req: Request) { return GET(req); }
