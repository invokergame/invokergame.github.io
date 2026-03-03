import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Awakening System',
  description: 'LitRPG chat game powered by Pony Alpha'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
