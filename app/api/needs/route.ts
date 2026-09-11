import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type NeedRow = {
  date: string;
  source: string;
  brand: string;
};

function normalizeDate(value: unknown): string | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const match = text.match(/^(\d{1,2})[-\/]([A-Za-z]{3}|\d{1,2})[-\/](\d{2,4})$/);
  if (match) {
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const day = match[1].padStart(2, '0');
    const monthRaw = match[2].toLowerCase();
    const month = months[monthRaw] || String(Number(monthRaw)).padStart(2, '0');
    const yearNum = Number(match[3]);
    const year = String(yearNum < 100 ? 2000 + yearNum : yearNum);
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

export async function GET() {
  try {
    const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL?.trim();
    const token = process.env.GOOGLE_SYNC_TOKEN?.trim();

    if (!scriptUrl || !token) {
      throw new Error('GOOGLE_APPS_SCRIPT_URL atau GOOGLE_SYNC_TOKEN belum dikonfigurasi');
    }

    const url = new URL(scriptUrl);
    url.searchParams.set('token', token);

    const response = await fetch(url.toString(), {
      cache: 'no-store',
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Google Apps Script mengembalikan HTTP ${response.status}`);
    }

    const payload = await response.json();
    if (payload?.ok === false) {
      throw new Error(payload?.error || 'Google Apps Script menolak request');
    }

    const rawRows = Array.isArray(payload?.rows) ? payload.rows : [];
    const rows: NeedRow[] = rawRows
      .map((row: Record<string, unknown>) => ({
        date: normalizeDate(row['Tanggal Input'] ?? row.date),
        source: String(row['Tracking Sumber Lead'] ?? row.source ?? '').trim(),
        brand: String(row['Nama Brand'] ?? row.brand ?? '').trim(),
        company: String(row['Tracking Perusahaan'] ?? row.company ?? '').trim(),
      }))
      .filter((row: { date: string | null; source: string; brand: string; company: string }) =>
        Boolean(row.date && row.source && row.brand && row.company)
      )
      .map((row: { date: string | null; source: string; brand: string }) => ({
        date: row.date as string,
        source: row.source,
        brand: row.brand,
      }));

    if (!rows.length) {
      return NextResponse.json(
        { error: 'Google Sheet tidak memiliki baris valid untuk dashboard' },
        { status: 422 }
      );
    }

    return NextResponse.json(
      { rows, total: rows.length, source: 'google-sheets' },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
