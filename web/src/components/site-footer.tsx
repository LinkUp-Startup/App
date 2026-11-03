export function SiteFooter() {
  return (
    <footer className="mx-auto max-w-5xl px-5 pt-16 pb-10 text-sm text-haze sm:px-8">
      <p className="max-w-prose">
        LinkUp is made by four students at the Universitat de Lleida. The app is in testing for
        Android and iOS.{' '}
        <a
          href="https://github.com/LinkUp-Startup/App"
          className="text-lavender underline decoration-haze/50 underline-offset-4 hover:decoration-lavender">
          Source code on GitHub
        </a>
      </p>
    </footer>
  );
}
