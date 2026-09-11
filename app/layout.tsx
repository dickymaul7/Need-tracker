import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Needs Tracking Dashboard',
  description: 'Dashboard sederhana untuk memantau jumlah needs berdasarkan periode, sumber, dan brand.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
