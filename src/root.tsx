import { Link, Outlet } from 'react-router-dom'
import SiteFooter from './components/SiteFooter'
import { BRAND } from './lib/brand'

export default function Root() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <header className="shrink-0 border-b-2 border-primary/70 bg-gradient-to-b from-[#0d2a49] via-[#081f38] to-background px-4 py-2 text-center shadow-[0_10px_40px_rgba(0,0,0,0.25)] md:py-4">
        <Link
          to="/"
          aria-label={`${BRAND.name} home`}
          className="mx-auto flex max-w-6xl items-center justify-center gap-3 rounded-2xl transition hover:scale-[1.01] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none md:gap-4"
        >
          <img
            src={BRAND.logoPath}
            alt=""
            className="size-14 rounded-2xl object-cover shadow-lg ring-2 ring-primary/60 md:size-20"
          />
          <div className="text-left">
            <h1 className="font-display text-2xl leading-none tracking-widest text-primary md:text-4xl">
              {BRAND.name}
            </h1>
            <p className="mt-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase md:text-sm">
              {BRAND.tagline}
            </p>
            <p className="mt-0.5 font-mono text-[0.65rem] text-muted-foreground/80 md:text-xs">
              {BRAND.domain}
            </p>
          </div>
        </Link>
      </header>
      <main className="relative mx-auto flex w-full max-w-6xl min-h-0 flex-1 flex-col overflow-hidden px-4 py-2 md:py-4">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}
