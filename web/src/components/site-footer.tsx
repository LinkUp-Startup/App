export function SiteFooter() {
  return (
    <footer className="mx-auto mt-24 max-w-6xl px-5 sm:mt-32 sm:px-8">
      <div className="flex flex-col gap-6 border-t border-violet/20 pt-8 pb-10 text-sm text-haze sm:flex-row sm:items-start sm:justify-between">
        <p className="font-display text-base font-extrabold text-lavender">LinkUp</p>
        <p className="max-w-[28rem] leading-relaxed">
          Made by four students at the Universitat de Lleida. The app is in testing for Android and
          iOS.
        </p>
        <a
          href="https://github.com/LinkUp-Startup/App"
          className="text-lavender underline decoration-haze/50 underline-offset-4 hover:decoration-lavender">
          Source code on GitHub
        </a>
      </div>
    </footer>
  );
}
