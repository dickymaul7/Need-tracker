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
    if (!clean) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;

    const dmy = clean.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
    if (dmy) {
      const year = Number(dmy[3]) < 100 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
      return `${year}-${String(Number(dmy[2])).padStart(2, '0')}-${String(Number(dmy[1])).padStart(2, '0')}`;
    }

    const dt = new Date(clean);
    if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  }
  return null;
}

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function toShareId(url: string) {
  return `u!${Buffer.from(url, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\//g, '_')
    .replace(/\+/g, '-')}`;
}

function guidFromShareToken(token: string): string | null {
  try {
    const normalized = token.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const bytes = Buffer.from(padded, 'base64');
    if (bytes.length < 18) return null;

    const g = bytes.subarray(2, 18);
    const hex = Buffer.from([
      g[3], g[2], g[1], g[0],
      g[5], g[4],
      g[7], g[6],
      ...g.subarray(8, 16),
    ]).toString('hex');

    return hex.length === 32 ? hex : null;
  } catch {
    return null;
  }
}

function buildDirectDownloadFromShortShare(shareUrl: string): string | null {
  try {
    const u = new URL(shareUrl);
    if (u.hostname !== '1drv.ms') return null;

    const parts = u.pathname.split('/').filter(Boolean);
    // Current personal OneDrive short links look like /x/c/{cid}/{opaque-share-token}
    if (parts.length < 4 || parts[1] !== 'c') return null;

    const cid = parts[2].toUpperCase();
    const token = parts[3];
    const itemGuid = guidFromShareToken(token);
    if (!/^[A-F0-9]{16}$/.test(cid) || !itemGuid) return null;

    const resid = `${cid}!s${itemGuid}`;
    return `https://onedrive.live.com/download?resid=${encodeURIComponent(resid)}`;
  } catch {
    return null;
  }
}

async function downloadWorkbook(): Promise<ArrayBuffer> {
  const directUrl = process.env.ONEDRIVE_EXCEL_DOWNLOAD_URL?.trim();
  const shareUrl = process.env.ONEDRIVE_SHARE_URL?.trim();

  if (!directUrl && !shareUrl) {
    throw new Error('ONEDRIVE_SHARE_URL atau ONEDRIVE_EXCEL_DOWNLOAD_URL belum dikonfigurasi');
  }

  const candidates: string[] = [];
  if (directUrl) candidates.push(directUrl);

  if (shareUrl) {
    const directFromShort = buildDirectDownloadFromShortShare(shareUrl);
    if (directFromShort) candidates.push(directFromShort);

    const u = new URL(shareUrl);
    u.searchParams.set('download', '1');
    candidates.push(u.toString());

    const shareId = toShareId(shareUrl);
    candidates.push(`https://api.onedrive.com/v1.0/shares/${shareId}/root/content`);
  }

  let lastError = 'Tidak dapat mengambil file OneDrive';

  for (const url of [...new Set(candidates)]) {
    try {
      const response = await fetch(url, {
        cache: 'no-store',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 NeedTracker/1.0',
          Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream,*/*',
        },
      });

      if (!response.ok) {
        lastError = `OneDrive mengembalikan HTTP ${response.status}`;
        continue;
      }

      const bytes = await response.arrayBuffer();
      const view = new Uint8Array(bytes.slice(0, 4));
      const isZipLike = view[0] === 0x50 && view[1] === 0x4b;
      if (!isZipLike) {
        lastError = 'Link OneDrive mengembalikan halaman HTML, bukan file XLSX';
        continue;
      }

      return bytes;
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Gagal mengakses OneDrive';
    }
  }

  throw new Error(lastError);
}

function extractRows(workbook: XLSX.WorkBook): NeedRow[] {
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: true });

    const headerRowIndex = matrix.findIndex((row) => {
      const headers = row.map(normalizeHeader);
      return headers.some((h) => h.includes('tanggal input')) && headers.some((h) => h.includes('nama brand'));
    });

    if (headerRowIndex < 0) continue;

    const headers = matrix[headerRowIndex].map(normalizeHeader);
    const dateIdx = headers.findIndex((h) => h === 'tanggal input' || h.includes('tanggal input'));
    const brandIdx = headers.findIndex((h) => h === 'nama brand' || h.includes('nama brand'));
    const sourceIdx = headers.findIndex((h) => h === 'tracking sumber lead' || h.includes('tracking sumber lead'));
    const companyIdx = headers.findIndex((h) => h === 'tracking perusahaan' || h.includes('tracking perusahaan'));

    if (dateIdx < 0 || brandIdx < 0 || sourceIdx < 0) continue;

    const rows: NeedRow[] = [];

    for (const row of matrix.slice(headerRowIndex + 1)) {
      const date = excelDateToISO(row[dateIdx]);
      const source = String(row[sourceIdx] ?? '').trim();
      const brand = String(row[brandIdx] ?? '').trim();
      const company = companyIdx >= 0 ? String(row[companyIdx] ?? '').trim() : 'valid';

      if (!date || !source || !brand || !company) continue;
      rows.push({ date, source, brand });
    }

    if (rows.length) return rows;
  }

  return [];
}

export async function GET() {
  try {
    const bytes = await downloadWorkbook();
    const workbook = XLSX.read(bytes, { type: 'array', cellDates: true });
    const rows = extractRows(workbook);

    if (!rows.length) {
      return NextResponse.json(
        { error: 'Kolom Tanggal Input, Nama Brand, dan Tracking Sumber Lead tidak ditemukan atau datanya kosong' },
        { status: 422 }
      );
    }

    return NextResponse.json(
      { rows, total: rows.length, source: 'onedrive' },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
