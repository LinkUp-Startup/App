import type { Metadata, Viewport } from 'next';
import { Atkinson_Hyperlegible, Bricolage_Grotesque } from 'next/font/google';
import './globals.css';

// Bricolage for headings and times; Atkinson because it stays legible on a phone in a dark street.
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage' });
const atkinson = Atkinson_Hyperlegible({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-atkinson',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? 'https://linkup.th7bo.dev'),
  title: { default: 'LinkUp', template: '%s – LinkUp' },
  description: 'Plan a whole night out in Lleida: real places, times and prices, in one go.',
};

export const viewport: Viewport = { themeColor: '#17133a' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${bricolage.variable} ${atkinson.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
