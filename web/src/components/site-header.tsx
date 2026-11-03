import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="mx-auto flex max-w-5xl items-center px-5 pt-6 sm:px-8">
      <Link href="/" className="font-display text-xl font-bold tracking-tight">
        LinkUp
      </Link>
    </header>
  );
}
