import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

type NeedRow = { date: string; source: string; brand: string };

function excelDateToISO(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
  }
  if (typeof value === 'string') {
    const clean = value.trim();
    const direct = /^\d{4}-\d{2}-\d{2}$/.test(clean) ? clean : null;
    if (direct) return direct;
    const dt = new Date(clean);
    if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  }
  return null;
}

function findValue(row: Record<string, unknown>, candidates: string[]) {
  const normalized = Object.entries(row).map(([key, value]) => [key.toLowerCase().trim(), value] as const);
  for (const candidate of candidates) {
    const hit = normalized.find(([key]) => key === candidate || key.includes(candidate));
    if (hit) return hit[1];
  }
  return undefined;
}

export async function GET() {
  const url = process.env.ONEDRIVE_EXCEL_DOWNLOAD_URL;
  if (!url) {
    return NextResponse.json({ error: 'ONEDRIVE_EXCEL_DOWNLOAD_URL belum dikonfigurasi' }, { status: 503 });
  }

  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Gagal mengambil file: ${response.status}`);
    const bytes = await response.arrayBuffer();
    const workbook = XLSX.read(bytes, { type: 'array', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

    const rows: NeedRow[] = raw.flatMap((row) => {
      const date = excelDateToISO(findValue(row, ['tanggal', 'date', 'periode']));
      const source = String(findValue(row, ['sumber need', 'sumber', 'source']) ?? '').trim();
      const brand = String(findValue(row, ['brand', 'merek']) ?? '').trim();
      if (!date || !source || !brand) return [];
      return [{ date, source, brand }];
    });

    return NextResponse.json({ rows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
