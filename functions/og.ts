import { buildOgSvg } from './_lib/og-image'
import { resolveShareFromUrl } from './_lib/resolve-share'
import { shareErrorResponse } from './_lib/share-errors'

type PagesContext = {
  request: Request
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const url = new URL(context.request.url)
  const resolved = resolveShareFromUrl(url)

  if ('kind' in resolved) {
    if (resolved.kind === 'validation') {
      return shareErrorResponse(resolved.error)
    }
    return new Response('Share link not found', { status: 404 })
  }

  const share = resolved

  const svg = buildOgSvg(share.result, share.lineup)
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
