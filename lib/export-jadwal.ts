// Export Jadwal Excel dengan format cetak ala spreadsheet referensi:
//  - Satu sheet per TINGKAT kelas (KELAS 7, KELAS 8, ...), kolom = kelas sejajar.
//  - Baris judul "JADWAL MATA PELAJARAN <NAMA SEKOLAH>", subjudul hijau "KELAS <tingkat>".
//  - Kolom HARI | JAM | KELAS x - A | KELAS x - B | ...; JAM digabung per sesi 2 JP.
//  - Tiap sesi 2 baris: nama mapel (tebal, huruf besar) lalu nama guru di bawahnya.
//  - Baris ISTIRAHAT di antara sesi dan pemisah hijau antarhari.
// Memakai ExcelJS karena SheetJS (xlsx) versi komunitas tidak menulis style/warna/border.
import ExcelJS from "exceljs";
import db, { getSettings } from "./db";
import { activeDays, periodsList, timeOf } from "./schedule";

const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12 };

export function parseClassName(name: string): { grade: number | null; gradeLabel: string; headLabel: string; suffix: string } {
  const m = String(name || "").trim().match(/^([A-Za-z]+|\d+)\s*[- ]\s*(.+)$/);
  if (!m) return { grade: null, gradeLabel: String(name || "").trim(), headLabel: String(name || "").trim().toUpperCase(), suffix: "" };
  const head = m[1].toUpperCase();
  const grade = /^\d+$/.test(head) ? parseInt(head, 10) : (ROMAN[head] ?? null);
  return { grade, gradeLabel: grade != null ? String(grade) : head, headLabel: head, suffix: m[2].trim().toUpperCase() };
}

const FONT = "Times New Roman";
const GREEN = "FF00B050";
const thin = { style: "thin" as const, color: { argb: "FF000000" } };
const BORDER = { top: thin, left: thin, bottom: thin, right: thin };

function styleCell(c: ExcelJS.Cell, o: { size?: number; bold?: boolean; fill?: string; wrap?: boolean } = {}) {
  c.font = { name: FONT, size: o.size ?? 11, bold: !!o.bold };
  c.alignment = { horizontal: "center", vertical: "middle", wrapText: !!o.wrap };
  c.border = BORDER;
  if (o.fill) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: o.fill } };
}

// Nama tampilan mapel di export: nama lengkap, tapi yang kepanjangan (>18 huruf)
// disingkat memakai kodenya (Ilmu Pengetahuan Sosial -> IPS, Pendidikan Jasmani... -> PJOK).
const disp = (e: any) => (String(e.sname).length > 18 ? String(e.scode) : String(e.sname)).toUpperCase();
const jamLabel = (day: string, p1: number, p2: number) => {
  const a = timeOf(day, p1).split("-")[0]?.trim() || "";
  const b = timeOf(day, p2).split("-")[1]?.trim() || "";
  return `${a.replace(":", ".")}-${b.replace(":", ".")}`;
};
const breakLabel = (day: string, afterPeriod: number, nextPeriod: number) => {
  const a = timeOf(day, afterPeriod).split("-")[1]?.trim() || "";
  const b = timeOf(day, nextPeriod).split("-")[0]?.trim() || "";
  return `${a.replace(":", ".")}-${b.replace(":", ".")}`;
};

export async function buildJadwalWorkbook(): Promise<Buffer> {
  const st = getSettings();
  const school = String(st.school_name || "").trim();
  const classes = (db.prepare("SELECT id,name FROM classes").all() as any[])
    .map(c => ({ ...c, parsed: parseClassName(c.name) }))
    .sort((a, b) => (a.parsed.grade ?? 999) - (b.parsed.grade ?? 999) || a.parsed.suffix.localeCompare(b.parsed.suffix) || a.name.localeCompare(b.name));
  const entries = db.prepare(`SELECT e.day, e.period, a.id assignment_id, a.class_id, s.code scode, s.name sname, t.name tname
    FROM entries e JOIN assignments a ON a.id=e.assignment_id
    JOIN subjects s ON s.id=a.subject_id JOIN teachers t ON t.id=a.teacher_id`).all() as any[];
  const at = new Map<string, any>();
  for (const e of entries) at.set(`${e.class_id}|${e.day}|${e.period}`, e);

  // Kelompokkan kelas per tingkat.
  const groups = new Map<string, { label: string; list: any[] }>();
  for (const c of classes) {
    const key = c.parsed.grade != null ? `g${c.parsed.grade}` : `x${c.parsed.gradeLabel}`;
    if (!groups.has(key)) groups.set(key, { label: c.parsed.gradeLabel, list: [] });
    groups.get(key)!.list.push(c);
  }

  const days = activeDays();
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistem Jadwal";
  wb.created = new Date();
  const usedNames = new Set<string>();

  for (const g of groups.values()) {
    let sheetName = `KELAS ${g.label}`.slice(0, 31);
    let n = 2; const base = sheetName;
    while (usedNames.has(sheetName)) sheetName = `${base} (${n++})`.slice(0, 31);
    usedNames.add(sheetName);
    const ws = wb.addWorksheet(sheetName, {
      pageSetup: { orientation: "landscape", paperSize: 8 as any /* A3 */, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    const lastCol = 2 + g.list.length;
    const lastLetter = ws.getColumn(lastCol).letter;
    ws.columns = [{ width: 14 }, { width: 17 }, ...g.list.map(() => ({ width: 23 }))];

    // Judul + subjudul.
    ws.mergeCells(`A1:${lastLetter}1`);
    const title = ws.getCell("A1");
    title.value = ("JADWAL MATA PELAJARAN" + (school ? ` ${school.toUpperCase()}` : "")).trim();
    styleCell(title, { size: 16, bold: true }); ws.getRow(1).height = 28;
    ws.mergeCells(`A2:${lastLetter}2`);
    const sub = ws.getCell("A2");
    sub.value = `KELAS ${g.label}`;
    styleCell(sub, { size: 14, bold: true, fill: GREEN }); ws.getRow(2).height = 24;

    // Header kolom.
    const hdr = ws.getRow(3); hdr.height = 22;
    styleCell(hdr.getCell(1), { size: 12, bold: true }); hdr.getCell(1).value = "HARI";
    styleCell(hdr.getCell(2), { size: 12, bold: true }); hdr.getCell(2).value = "JAM";
    g.list.forEach((c, i) => {
      const cell = hdr.getCell(3 + i);
      cell.value = c.parsed.suffix ? `KELAS ${c.parsed.headLabel} - ${c.parsed.suffix}` : String(c.name).toUpperCase();
      styleCell(cell, { size: 12, bold: true, wrap: true });
    });

    let r = 4;
    days.forEach((day, di) => {
      const dayStart = r;
      const ps = periodsList(day);
      const pairs: [number, number][] = [];
      for (let i = 0; i + 1 < ps.length; i += 2) pairs.push([ps[i], ps[i + 1]]);
      pairs.forEach(([p1, p2], si) => {
        // Baris nama mapel + baris nama guru.
        ws.getRow(r).height = 28; ws.getRow(r + 1).height = 20;
        ws.mergeCells(r, 2, r + 1, 2);
        const jam = ws.getCell(r, 2); jam.value = jamLabel(day, p1, p2); styleCell(jam, { size: 11, bold: true });
        styleCell(ws.getCell(r + 1, 2), { size: 11, bold: true });
        let pairRow = false;
        g.list.forEach((c, i) => {
          const col = 3 + i;
          const e1 = at.get(`${c.id}|${day}|${p1}`), e2 = at.get(`${c.id}|${day}|${p2}`);
          const codeCell = ws.getCell(r, col), teachCell = ws.getCell(r + 1, col);
          if (e1 && e2 && e1.assignment_id !== e2.assignment_id) {
            pairRow = true;
            // Dua kartu 1JP berbeda dalam satu sesi: tiap baris "NAMA MAPEL - Nama Guru"
            // (baris atas JP pertama, baris bawah JP kedua), kode ditebalkan via rich text.
            const line = (e: any) => ({ richText: [
              { text: `${disp(e)} - `, font: { name: FONT, size: 10, bold: true } },
              { text: String(e.tname), font: { name: FONT, size: 10 } },
            ] });
            codeCell.value = line(e1) as any; teachCell.value = line(e2) as any;
            styleCell(codeCell, { size: 10, wrap: true }); styleCell(teachCell, { size: 10, wrap: true });
            // styleCell menimpa font sel; kembalikan rich text setelahnya tidak perlu karena
            // ExcelJS memakai font per-run saat value berupa richText.
            codeCell.value = line(e1) as any; teachCell.value = line(e2) as any;
          } else {
            let codes = "", teachers = "";
            if (e1 && e2) { codes = disp(e1); teachers = e1.tname; }
            else if (e1 || e2) { const e = e1 || e2; codes = disp(e); teachers = e.tname; }
            codeCell.value = codes; teachCell.value = teachers;
            styleCell(codeCell, { size: 11, bold: true, wrap: true });
            styleCell(teachCell, { size: 10, wrap: true });
          }
        });
        if (pairRow) { ws.getRow(r).height = 38; ws.getRow(r + 1).height = 38; }
        r += 2;
        // Baris istirahat setelah sesi JP1-2 dan setelah sesi sebelum JP7.
        const next = pairs[si + 1];
        if (next && (p2 === 2 || next[0] === 7)) {
          ws.getRow(r).height = 18;
          const jamB = ws.getCell(r, 2); jamB.value = breakLabel(day, p2, next[0]); styleCell(jamB, { size: 11, bold: true });
          ws.mergeCells(r, 3, r, lastCol);
          const brk = ws.getCell(r, 3); brk.value = "ISTIRAHAT"; styleCell(brk, { size: 11, bold: true });
          for (let col = 4; col <= lastCol; col++) styleCell(ws.getCell(r, col), { size: 11, bold: true });
          r += 1;
        }
      });
      // Kolom HARI digabung sepanjang hari itu.
      ws.mergeCells(dayStart, 1, r - 1, 1);
      const dayCell = ws.getCell(dayStart, 1); dayCell.value = day.toUpperCase(); styleCell(dayCell, { size: 12, bold: true });
      for (let rr = dayStart + 1; rr < r; rr++) styleCell(ws.getCell(rr, 1), { size: 12, bold: true });
      // Pemisah hijau antarhari.
      if (di < days.length - 1) {
        ws.getRow(r).height = 10;
        ws.mergeCells(r, 1, r, lastCol);
        styleCell(ws.getCell(r, 1), { fill: GREEN });
        for (let col = 2; col <= lastCol; col++) styleCell(ws.getCell(r, col), { fill: GREEN });
        r += 1;
      }
    });
    ws.views = [{ state: "frozen", xSplit: 2, ySplit: 3 }];
  }
  if (!wb.worksheets.length) wb.addWorksheet("Jadwal");
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
