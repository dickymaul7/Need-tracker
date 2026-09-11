# Needs Tracking Dashboard

MVP dashboard untuk memantau:
- periode/tanggal
- total need
- sumber need
- brand

## Menjalankan lokal

```bash
npm install
cp .env.example .env.local
npm run dev
```

Tanpa `ONEDRIVE_EXCEL_DOWNLOAD_URL`, dashboard otomatis tampil dengan data contoh.

## Koneksi OneDrive

Isi `.env.local`:

```env
ONEDRIVE_EXCEL_DOWNLOAD_URL=https://...
```

URL harus menghasilkan file `.xlsx` secara langsung dan bisa diakses dari server. API `/api/needs` membaca sheet pertama dan mencoba mengenali kolom `Tanggal`, `Sumber Need`, dan `Brand`.

Jika workbook aktual memakai header berbeda, sesuaikan kandidat header di `app/api/needs/route.ts`.
