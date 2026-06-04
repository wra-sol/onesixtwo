import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { BRAND } from '@/lib/brand'

type LegalSection = {
  title: string
  paragraphs: string[]
}

type LegalPageConfig = {
  slug: 'privacy' | 'terms' | 'data'
  title: string
  canonicalPath: string
  sections: LegalSection[]
}

const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: 'Who operates this site',
    paragraphs: [
      `${BRAND.name} is operated at ${BRAND.url}. For privacy questions, contact ${BRAND.contactEmail}.`,
    ],
  },
  {
    title: 'What we collect',
    paragraphs: [
      'The game does not require an account. We do not ask you to submit your name, email, or other personal information to play.',
      'Your draft progress lives in your browser memory until you refresh or leave the page. We do not store your lineup on our servers unless you choose to submit to the leaderboard.',
      'If you submit to the leaderboard, we store your chosen initials (2–3 letters), your validated score and record, a share link for your lineup, a timestamp, and a hashed network identifier for rate limiting. Leaderboard data is stored in Cloudflare D1 and shown publicly on the site.',
      'Your browser may remember your last leaderboard initials in local storage for convenience. You can clear this by clearing site data for this domain.',
    ],
  },
  {
    title: 'Clipboard and sharing',
    paragraphs: [
      'If you tap Copy result or use your device share sheet, that action is initiated by you. Copied text stays on your device or is sent through your operating system — we do not receive it.',
    ],
  },
  {
    title: 'Analytics',
    paragraphs: [
      'We use Cloudflare Web Analytics, a privacy-oriented, cookieless analytics service that helps us understand aggregate traffic (for example page views, referrers, and device types). It is not used to identify individual visitors. See Cloudflare’s documentation at https://developers.cloudflare.com/analytics/web-analytics/.',
      'We do not use Google Analytics or advertising pixels at launch.',
    ],
  },
  {
    title: 'Hosting and security',
    paragraphs: [
      'The site is hosted on Cloudflare Pages. Cloudflare may process technical data such as IP addresses and request logs for delivery, security, and abuse prevention. See https://www.cloudflare.com/privacypolicy/.',
      'Cloudflare may set essential or security-related cookies in connection with hosting.',
    ],
  },
  {
    title: 'Children',
    paragraphs: [
      'This site is not directed at children under 13, and we do not knowingly collect personal information from children.',
    ],
  },
  {
    title: 'Changes',
    paragraphs: [
      `We may update this policy. The “Last updated” date below shows when it last changed. Continued use of the site after changes means you accept the updated policy.`,
    ],
  },
]

const TERMS_SECTIONS: LegalSection[] = [
  {
    title: 'Agreement',
    paragraphs: [
      `By using ${BRAND.name} at ${BRAND.url}, you agree to these Terms of Use. If you do not agree, do not use the site.`,
    ],
  },
  {
    title: 'Entertainment only',
    paragraphs: [
      'Projected win-loss records, ratings, and headlines are fictional game output. They are not betting advice, forecasts, or guarantees of real-world performance.',
    ],
  },
  {
    title: 'No affiliation',
    paragraphs: [
      'This is an unofficial fan game. MLB, its teams, players, and affiliated marks are not endorsed by or affiliated with this site.',
    ],
  },
  {
    title: 'Acceptable use',
    paragraphs: [
      'Do not scrape, bulk-download, or automate abuse of site assets or data files. Do not attempt to disrupt the service or other users.',
    ],
  },
  {
    title: 'Intellectual property',
    paragraphs: [
      'The site UI and code are owned by the operator. Player names and historical statistics are sourced under the data policy described on the Data page. Third-party trademarks belong to their owners.',
    ],
  },
  {
    title: 'Disclaimer',
    paragraphs: [
      'The site is provided “as is” without warranties of any kind. To the fullest extent permitted by law, the operator is not liable for indirect, incidental, or consequential damages arising from use of the site.',
    ],
  },
  {
    title: 'Governing law',
    paragraphs: [
      `These terms are governed by the laws of ${BRAND.governingLaw}, without regard to conflict-of-law rules.`,
    ],
  },
  {
    title: 'Changes and termination',
    paragraphs: [
      'We may modify or discontinue the site at any time. We may update these terms; continued use after updates constitutes acceptance.',
    ],
  },
]

const DATA_SECTIONS: LegalSection[] = [
  {
    title: 'How the game works',
    paragraphs: [
      'Each draft round starts with a spin for a franchise and an era. That gives you a small pool of players who actually fit that team-decade combination. Pick one, place them in an open lineup spot, then keep building until your roster is full.',
      'When the lineup is complete, the engine turns your choices into a 162-game projection. Hitters help through things like getting on base, hitting for power, and avoiding weak spots in the order. Pitchers help by preventing runs. The final record is a playful estimate of how dominant that fantasy roster might be, not a claim about what would happen in real life.',
      'The fun is in the tradeoffs: do you take the best player available, save a position for later, spend a respin, or trust that another legend will show up? The goal is simple: chase the perfect 162-0 season.',
    ],
  },
  {
    title: 'Player data',
    paragraphs: [
      'Player names and career statistics come primarily from the Lahman Baseball Database (via Baseball Reference IDs), plus curated seed entries for iconic cards. See https://sabr.org/lahman-database/.',
      'Lahman Baseball Database © Sean Lahman / SABR. Used under their public distribution terms for research and non-commercial use.',
      'We do not scrape Baseball Reference or FanGraphs for live data.',
    ],
  },
  {
    title: 'How pools are built',
    paragraphs: [
      'Players are grouped into franchise–era buckets (1960s–2020s). Rankings use decade stat totals from Lahman and tuned ratings on seed cards — not live WAR or current-season stats.',
      'The same real person may appear on multiple franchise-era cards, but you cannot draft the same person twice in one game.',
    ],
  },
  {
    title: 'Design inspiration',
    paragraphs: [
      `The idea behind the game engine owes a clear debt to Strat-O-Matic Baseball, the tabletop classic that taught generations of fans how statistics, chance, and imagination can make baseball feel alive. ${BRAND.name} is an independent fan project and is not affiliated with Strat-O-Matic, MLB, or its teams.`,
      `The web-game format is also inspired by ${BRAND.inspiredByName} (${BRAND.inspiredByUrl}).`,
    ],
  },
  {
    title: 'A personal thank you',
    paragraphs: [
      'Thank you to my Dad, Dean, for showing me how to fall in love with baseball.',
    ],
  },
]

const PAGES: Record<LegalPageConfig['slug'], LegalPageConfig> = {
  privacy: {
    slug: 'privacy',
    title: 'Privacy Policy',
    canonicalPath: '/privacy',
    sections: PRIVACY_SECTIONS,
  },
  terms: {
    slug: 'terms',
    title: 'Terms of Use',
    canonicalPath: '/terms',
    sections: TERMS_SECTIONS,
  },
  data: {
    slug: 'data',
    title: 'Data & Attributions',
    canonicalPath: '/data',
    sections: DATA_SECTIONS,
  },
}

function LegalDocument({ config }: { config: LegalPageConfig }) {
  useEffect(() => {
    document.title = `${config.title} | ${BRAND.name}`
    let canonical = document.querySelector('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    canonical.setAttribute('href', `${BRAND.url}${config.canonicalPath}`)
    return () => {
      document.title = `${BRAND.name} | MLB All-Time Draft`
      canonical?.setAttribute('href', `${BRAND.url}/`)
    }
  }, [config])

  return (
    <div className="min-h-0 flex-1 overflow-y-auto py-2">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle className="font-display text-xl text-primary">
            {config.title}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Last updated: {BRAND.legalLastUpdated}
          </p>
        </CardHeader>
        <CardContent className="space-y-6 text-sm leading-relaxed">
          {config.sections.map((section) => (
            <section key={section.title}>
              <h2 className="font-display mb-2 text-base text-primary">
                {section.title}
              </h2>
              {section.paragraphs.map((p) => (
                <p key={p} className="mb-2 text-muted-foreground last:mb-0">
                  {p}
                </p>
              ))}
            </section>
          ))}
          <p>
            <Link
              to="/"
              className="font-medium text-primary underline underline-offset-2"
            >
              ← Back to game
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export function PrivacyPage() {
  return <LegalDocument config={PAGES.privacy} />
}

export function TermsPage() {
  return <LegalDocument config={PAGES.terms} />
}

export function DataPage() {
  return <LegalDocument config={PAGES.data} />
}
