export function SiteFooter() {
  return (
    <footer className="mx-auto mt-24 max-w-6xl px-5 sm:mt-32 sm:px-8">
      <div className="flex flex-col gap-6 border-t-[3px] border-dashed border-plum pt-8 pb-10 text-sm text-mauve sm:flex-row sm:items-start sm:justify-between">
        <p className="font-display text-2xl leading-none font-black text-blush uppercase">LinkUp</p>
        <p className="max-w-[28rem] leading-relaxed">
          Made by four students at the Universitat de Lleida. The app is in testing for Android and
          iOS.
        </p>
        <a
          href="https://github.com/LinkUp-Startup/App"
          className="text-blush underline decoration-mauve/50 underline-offset-4 hover:decoration-blush">
          Source code on GitHub
        </a>
      </div>
    </footer>
  );
}
