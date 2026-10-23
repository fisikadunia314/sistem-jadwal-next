import { NextResponse } from "next/server";

// Redirect-nya sengaja RELATIF ("/login"), bukan dibangun dari req.url.
//
// Kalau memakai new URL("/login", req.url), host yang dipakai request ikut
// tercetak ke Location. Saat server dijalankan dengan `-H 0.0.0.0` (wajib untuk
// akses dari perangkat lain / preview / container), browser bisa mengirim
// Host: 0.0.0.0:3000 — hasilnya Location: http://0.0.0.0:3000/login, dan
// alamat bar browser jadi "0.0.0.0" yang bukan alamat tujuan yang valid.
// Dengan Location relatif, browser tetap berada di host yang sedang dipakai
// (localhost, IP LAN, atau domain proxy/reverse proxy).
function keluar() {
  const res = new NextResponse(null, {
    status: 303,
    headers: { Location: "/login", "Cache-Control": "no-store" },
  });
  res.cookies.delete("sid");
  return res;
}

export async function GET() {
  return keluar();
}

export async function POST() {
  return keluar();
}
