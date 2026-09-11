'use client';

import { useEffect, useMemo, useState } from 'react';

type NeedRow = {
  date: string;
  source: string;
  brand: string;
};

const fallbackData: NeedRow[] = [
  { date: '2026-09-01', source: 'Database', brand: 'Proxsis Academy' },
  { date: '2026-09-01', source: 'Database', brand: 'ISO Center Indonesia' },
  { date: '2026-09-02', source: 'Referral', brand: 'Proxsis Academy' },
  { date: '2026-09-02', source: 'Website', brand: 'GRC Indonesia' },
  { date: '2026-09-03', source: 'Database', brand: 'Proxsis Academy' },
  { date: '2026-09-03', source: 'Community', brand: 'ICICERT Indonesia' },
  { date: '2026-09-04', source: 'Database', brand: 'ISO Center Indonesia' },
  { date: '2026-09-05', source: 'Referral', brand: 'GRC Indonesia' },
  { date: '2026-09-05', source: 'Database', brand: 'Proxsis Academy' },
  { date: '2026-09-06', source: 'Website', brand: 'Proxsis Academy' },
  { date: '2026-09-07', source: 'Database', brand: 'ICICERT Indonesia' },
  { date: '2026-09-08', source: 'Database', brand: 'Proxsis Academy' },
  { date: '2026-09-09', source: 'Community', brand: 'GRC Indonesia' },
  { date: '2026-09-10', source: 'Database', brand: 'ISO Center Indonesia' },
  { date: '2026-09-11', source: 'Referral', brand: 'Proxsis Academy' },
];

function countBy(rows: NeedRow[], key: 'source' | 'brand') {
  return Object.entries(
    rows.reduce<Record<string, number>>((acc, row) => {
      acc[row[key]] = (acc[row[key]] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);
}

function rangeFromRows(rows: NeedRow[]) {
  const dates = rows.map((row) => row.date).filter(Boolean).sort();
  return dates.length ? { start: dates[0], end: dates[dates.length - 1] } : null;
}

export default function Home() {
  const [rows, setRows] = useState<NeedRow[]>(fallbackData);
  const [dataMode, setDataMode] = useState<'live' | 'demo'>('demo');
  const [lastUpdated, setLastUpdated] = useState<string>('Data contoh');
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('2026-09-01');
  const [endDate, setEndDate] = useState('2026-09-11');

  async function refreshData() {
    setLoading(true);
    try {
      const res = await fetch('/api/needs', { cache: 'no-store' });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Live source belum tersedia');

      if (Array.isArray(payload.rows) && payload.rows.length) {
        setRows(payload.rows);
        const range = rangeFromRows(payload.rows);
        if (range) {
          setStartDate(range.start);
          setEndDate(range.end);
        }
        setDataMode('live');
        setLastUpdated(new Date().toLocaleString('id-ID'));
      }
    } catch (error) {
      setRows(fallbackData);
      setDataMode('demo');
      setLastUpdated(error instanceof Error ? `Demo — ${error.message}` : 'Data contoh — koneksi Google Sheets belum dikonfigurasi');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshData();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((row) => row.date >= startDate && row.date <= endDate);
  }, [rows, startDate, endDate]);

  const bySource = useMemo(() => countBy(filtered, 'source'), [filtered]);
  const byBrand = useMemo(() => countBy(filtered, 'brand'), [filtered]);
  const maxSource = Math.max(1, ...bySource.map(([, count]) => count));
  const maxBrand = Math.max(1, ...byBrand.map(([, count]) => count));

  return (
    <main className="page-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">PROXSIS • NEED MONITORING</p>
          <h1>Needs Tracking Dashboard</h1>
          <p className="subtitle">Pantau jumlah kebutuhan berdasarkan periode, sumber need, dan brand dalam satu tampilan sederhana.</p>
        </div>
        <div className="status-wrap">
          <span className={`status-dot ${dataMode}`} />
          <span>{dataMode === 'live' ? 'Live dari Google Sheets' : 'Demo data'}</span>
        </div>
      </section>

      <section className="filter-card">
        <div className="filter-group">
          <label>Tanggal mulai</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="filter-group">
          <label>Tanggal akhir</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <button className="refresh-btn" onClick={refreshData} disabled={loading}>
          {loading ? 'Memuat...' : 'Refresh data'}
        </button>
        <div className="updated">Terakhir diperbarui<br /><strong>{lastUpdated}</strong></div>
      </section>

      <section className="kpi-grid">
        <article className="kpi-card primary">
          <span>Total Need</span>
          <strong>{filtered.length}</strong>
          <small>{startDate} s.d. {endDate}</small>
        </article>
        <article className="kpi-card">
          <span>Sumber Need Aktif</span>
          <strong>{bySource.length}</strong>
          <small>pada periode terpilih</small>
        </article>
        <article className="kpi-card">
          <span>Brand Aktif</span>
          <strong>{byBrand.length}</strong>
          <small>pada periode terpilih</small>
        </article>
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">BREAKDOWN</p>
              <h2>Sumber Need</h2>
            </div>
            <span>{filtered.length} total</span>
          </div>
          <div className="bar-list">
            {bySource.length ? bySource.map(([name, count]) => (
              <div className="bar-item" key={name}>
                <div className="bar-label"><span>{name}</span><strong>{count}</strong></div>
                <div className="track"><div className="fill" style={{ width: `${(count / maxSource) * 100}%` }} /></div>
              </div>
            )) : <p className="empty">Tidak ada data pada periode ini.</p>}
          </div>
        </article>

        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">BREAKDOWN</p>
              <h2>Brand</h2>
            </div>
            <span>{byBrand.length} brand</span>
          </div>
          <div className="bar-list">
            {byBrand.length ? byBrand.map(([name, count]) => (
              <div className="bar-item" key={name}>
                <div className="bar-label"><span>{name}</span><strong>{count}</strong></div>
                <div className="track"><div className="fill secondary" style={{ width: `${(count / maxBrand) * 100}%` }} /></div>
              </div>
            )) : <p className="empty">Tidak ada data pada periode ini.</p>}
          </div>
        </article>
      </section>

      <section className="table-panel">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">DATA DETAIL</p>
            <h2>Needs dalam periode terpilih</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Tanggal</th><th>Sumber Need</th><th>Brand</th></tr></thead>
            <tbody>
              {filtered.slice().reverse().map((row, idx) => (
                <tr key={`${row.date}-${row.source}-${row.brand}-${idx}`}>
                  <td>{new Date(row.date + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td>{row.source}</td>
                  <td>{row.brand}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
