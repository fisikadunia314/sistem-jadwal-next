import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { allEntries, activeDays, PPD, periodsList, timeOf } from "@/lib/schedule";
import db from "@/lib/db";
export const dynamic = "force-dynamic";
const PALETTE = ["#dbeafe|#1d4ed8","#dcfce7|#15803d","#fef3c7|#b45309","#fce7f3|#be185d","#e0e7ff|#4338ca","#ccfbf1|#0f766e","#ffedd5|#c2410c","#f3e8ff|#7e22ce","#ffe4e6|#be123c","#ecfccb|#4d7c0f","#cffafe|#155e75","#fef9c3|#a16207","#ede9fe|#6d28d9","#d1fae5|#065f46","#fee2e2|#b91c1c","#e0f2fe|#0369a1","#fbcfe8|#9d174d","#bfdbfe|#1e40af","#bbf7d0|#166534","#fde68a|#92400e","#ddd6fe|#5b21b6","#a5f3fc|#164e63","#fecdd3|#881337"];
export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ ok: false, error: "Sesi berakhir, login ulang." }, { status: 401 });
  const entries = allEntries();
  const subjRows = [...new Map(entries.map(e => [e.subject_id, e.scode])).entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  const subjColor = new Map(subjRows.map(([id], i) => [id, PALETTE[i % PALETTE.length]]));
  const teachRows = [...new Map(entries.map(e => [e.teacher_id, e.tcode])).entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  const teachColor = new Map(teachRows.map(([id], i) => [id, PALETTE[(i + 7) % PALETTE.length]]));
  const slots: any[] = [];
  for (const d of activeDays()) for (let p = 1; p <= PPD; p++)
    slots.push({ day: d, period: p, time: timeOf(d, p), teachable: periodsList(d).includes(p), break_label: d === "Jumat" && (p === 5 || p === 6) ? "Ibadah & Istirahat" : "" });
  const classKey = (n: string) => { const m = n.match(/^(\d+)-([A-Z])/); return m ? [parseInt(m[1]), m[2]] : [99, n]; };
  const classes = (db.prepare("SELECT id,name FROM classes").all() as any[])
    .sort((a, b) => { const [g1, l1] = classKey(a.name), [g2, l2] = classKey(b.name); return (g1 as number) - (g2 as number) || String(l1).localeCompare(String(l2)); });
  return NextResponse.json({ ok: true, is_admin: u.role === "admin", me: { id: u.id, name: u.display_name, role: u.role, teacher_id: u.teacher_id },
    slots, classes,
    entries: entries.map(e => { const [bg, fg] = (subjColor.get(e.subject_id) || PALETTE[0]).split("|"); const [tbg, tfg] = (teachColor.get(e.teacher_id) || PALETTE[1]).split("|");
      return { id: e.id, assignment_id: e.assignment_id, class_id: e.class_id, class_name: e.cname, teacher_id: e.teacher_id,
        teacher: e.tname, tcode: e.tcode, subject_id: e.subject_id, subject: e.sname, scode: e.scode, day: e.day, period: e.period,
        bg, fg, tbg, tfg, mine: u.role === "admin" || u.teacher_id === e.teacher_id }; }) });
}
