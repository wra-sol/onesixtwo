import { Link, NavLink, Outlet } from 'react-router-dom'
import SiteFooter from './components/SiteFooter'
import { BRAND } from './lib/brand'

const NAV_ITEMS = [
  { to: '/', label: 'Play', end: true },
  { to: '/daily-matchup', label: 'Daily' },
  { to: '/live-draft', label: 'Live' },
  { to: '/sim162', label: 'Sim 162' },
  { to: '/leaderboard', label: 'Board' },
] as const

export default function Root() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to game
      </a>
      <header className="sticky top-0 z-40 border-b border-primary/35 bg-background/95 shadow-[0_4px_18px_rgba(0,0,0,0.2)] backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex min-h-14 max-w-6xl items-center gap-3 px-3 md:px-4">
          <Link
            to="/"
            aria-label={`${BRAND.name} home`}
            className="group flex min-w-0 items-center gap-2 rounded-lg px-1 py-1 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <img
              src={BRAND.logoPath}
              alt=""
              className="size-9 rounded-md object-cover ring-1 ring-primary/60 transition-transform group-hover:scale-[1.03] md:size-10"
            />
            <span className="min-w-0">
              <span className="block truncate font-display text-sm leading-none text-primary md:text-base">
                {BRAND.name}
              </span>
              <span className="mt-0.5 hidden text-[0.62rem] font-medium tracking-wide text-muted-foreground uppercase sm:block">
                Goal {BRAND.perfectRecord}
              </span>
            </span>
          </Link>

          <nav className="game-nav ml-auto" aria-label="Game modes">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={'end' in item ? item.end : false}
                className={({ isActive }) =>
                  `game-nav__link${isActive ? ' game-nav__link--active' : ''}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="relative mx-auto min-h-[calc(100vh-8rem)] w-full max-w-6xl px-3 py-3 outline-none md:px-4 md:py-5"
      >
        <Outlet />
      </main>
      <SiteFooter />
    </>
  )
}
