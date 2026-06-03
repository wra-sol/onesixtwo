import { Link } from 'react-router-dom'
import { BRAND } from '@/lib/brand'

export default function SiteFooter() {
  return (
    <footer className="shrink-0 border-t border-border px-3 py-3 text-center text-xs text-muted-foreground md:px-4 md:py-4 md:text-sm">
      <nav
        className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1"
        aria-label="Site links"
      >
        <Link
          to="/privacy"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Privacy
        </Link>
        <span aria-hidden="true">·</span>
        <Link
          to="/terms"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Terms
        </Link>
        <span aria-hidden="true">·</span>
        <Link
          to="/data"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Data
        </Link>
        <span aria-hidden="true">·</span>
        <a
          href={BRAND.url}
          className="underline underline-offset-2 hover:text-foreground"
        >
          {BRAND.domain}
        </a>
        <span aria-hidden="true">·</span>
        <span>
          Inspired by{' '}
          <a
            href={BRAND.inspiredByUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            {BRAND.inspiredByName}
          </a>
        </span>
      </nav>
    </footer>
  )
}
