import { useEffect } from 'react'
import { BRAND } from './brand'
import { formatLineupShareSummary } from './brand'
import { buildOgPath } from './share-url'
import type { ParsedShare } from './share-url'
import type { Lineup, SeasonResult } from './types'
import { LINEUP_POSITIONS } from './types'

type MetaDescriptor =
  | { selector: string; name: string; value: string }
  | { selector: string; property: string; value: string }

function upsertMeta(descriptor: MetaDescriptor) {
  let element = document.head.querySelector<HTMLMetaElement>(descriptor.selector)
  if (!element) {
    element = document.createElement('meta')
    if ('name' in descriptor) {
      element.setAttribute('name', descriptor.name)
    } else {
      element.setAttribute('property', descriptor.property)
    }
    document.head.appendChild(element)
  }
  element.setAttribute('content', descriptor.value)
}

export function useSharePageMeta(
  result: SeasonResult | null,
  lineup: Lineup | null,
  parsed: ParsedShare | null,
  searchParams: URLSearchParams,
) {
  useEffect(() => {
    if (!result || !lineup || !parsed) {
      document.title = `Share link | ${BRAND.name}`
      return
    }

    const sharePath = `/share?${searchParams.toString()}`
    const shareUrl = `${BRAND.url}${sharePath}`
    const imageUrl = `${BRAND.url}${buildOgPath(parsed)}`
    const title = sharePageTitle(result.record)
    const description = sharePageDescription(result, lineup)
    document.title = title

    let canonical = document.querySelector('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    canonical.setAttribute('href', shareUrl)

    const metaTags: MetaDescriptor[] = [
      { selector: 'meta[property="og:title"]', property: 'og:title', value: title },
      {
        selector: 'meta[property="og:description"]',
        property: 'og:description',
        value: description,
      },
      { selector: 'meta[property="og:url"]', property: 'og:url', value: shareUrl },
      { selector: 'meta[property="og:image"]', property: 'og:image', value: imageUrl },
      {
        selector: 'meta[property="og:image:alt"]',
        property: 'og:image:alt',
        value: `${title} season card`,
      },
      {
        selector: 'meta[name="twitter:title"]',
        name: 'twitter:title',
        value: title,
      },
      {
        selector: 'meta[name="twitter:description"]',
        name: 'twitter:description',
        value: description,
      },
      {
        selector: 'meta[name="twitter:image"]',
        name: 'twitter:image',
        value: imageUrl,
      },
    ]
    metaTags.forEach(upsertMeta)

    return () => {
      document.title = `${BRAND.name} | MLB All-Time Draft`
      canonical?.setAttribute('href', `${BRAND.url}/`)
    }
  }, [lineup, parsed, result, searchParams])
}

export function sharePageTitle(record: string): string {
  return `${BRAND.name} · ${record}`
}

export function sharePageDescription(
  result: SeasonResult,
  lineup: Lineup,
): string {
  return `${result.tier.label} — ${formatLineupShareSummary(LINEUP_POSITIONS, lineup)}`
}
