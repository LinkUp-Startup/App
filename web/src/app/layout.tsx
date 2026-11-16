import type { Metadata, Viewport } from 'next';
import { Big_Shoulders, Figtree } from 'next/font/google';
import { connection } from 'next/server';
import './globals.css';

// Big Shoulders, tall poster capitals, for headings and times; Figtree, plain and easy to read, for text.
const bigShoulders = Big_Shoulders({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--font-big-shoulders',
});
const figtree = Figtree({ subsets: ['latin'], variable: '--font-figtree' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? 'https://linkup.th7bo.dev'),
  title: { default: 'LinkUp', template: '%s – LinkUp' },
  description: 'Plan a whole night out in Lleida: real places, times and prices, in one go.',
};

export const viewport: Viewport = { themeColor: '#2b0d1e' };

// Rendered per request: the Content Security Policy nonce (src/proxy.ts) can't be added to a page built ahead of time.
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();
  return (
    <html lang="en" className={`${bigShoulders.variable} ${figtree.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
