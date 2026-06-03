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
      'Your draft progress lives in your browser memory until you refresh or leave the page. We do not store your lineup on our servers.',
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
      `Gameplay is inspired by ${BRAND.inspiredByName} (${BRAND.inspiredByUrl}). ${BRAND.name} is an independent project.`,
    ],
  },
  {
    title: 'For developers',
    paragraphs: [
      'Build pipeline, licensing notes, and dataset policy: see docs/DATA_POLICY.md in the project repository.',
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
