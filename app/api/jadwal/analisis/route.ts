import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { allEntries, moveOptions } from "@/lib/schedule";
export async function POST(req: NextRequest) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ ok: false, error: "Sesi berakhir, login ulang." }, { status: 401 });
  const { entryId, pairId } = await req.json();
  const entries = allEntries();
  const e = entries.find(x => x.id === Number(entryId));
  if (!e) return NextResponse.json({ ok: false, error: "Kartu tidak ditemukan di jadwal aktif. Papan akan disegarkan." }, { status: 404 });
  if (u.role !== "admin" && u.teacher_id !== e.teacher_id)
    return NextResponse.json({ ok: false, error: "Hanya pemilik jadwal / Superadmin." }, { status: 403 });
  const pair = pairId ? entries.find(x => x.id === Number(pairId)) : null;
  if (pairId && (!pair || pair.assignment_id !== e.assignment_id || pair.class_id !== e.class_id))
    return NextResponse.json({ ok: false, error: "Pasangan blok 2 JP tidak valid." }, { status: 400 });
  const r: any = moveOptions(e, entries, pair || null);
  return NextResponse.json({ ok: true, is_admin: u.role === "admin", slots: r.slots, swap_ids: r.swaps, is_block: !!r.isBlock });
}
