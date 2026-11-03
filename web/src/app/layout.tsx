import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Lexend } from 'next/font/google';
import './globals.css';

// Bricolage for headings and times; Lexend, made for readability, for text read on a phone in a dark street.
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage' });
const lexend = Lexend({ subsets: ['latin'], variable: '--font-lexend' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? 'https://linkup.th7bo.dev'),
  title: { default: 'LinkUp', template: '%s – LinkUp' },
  description: 'Plan a whole night out in Lleida: real places, times and prices, in one go.',
};

export const viewport: Viewport = { themeColor: '#17133a' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${bricolage.variable} ${lexend.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
