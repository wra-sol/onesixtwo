import { buildOgSvg } from './_lib/og-image'
import { renderOgPng } from './_lib/og-png'
import { respondWithEdgeCache } from './_lib/cache'
import { resolveShareFromUrl } from './_lib/resolve-share'
import { shareErrorResponse } from './_lib/share-errors'

type PagesContext = {
  request: Request
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const url = new URL(context.request.url)
  return respondWithEdgeCache(url, () => buildOgResponse(url))
}

async function buildOgResponse(url: URL): Promise<Response> {
  const resolved = resolveShareFromUrl(url)

  if ('kind' in resolved) {
    if (resolved.kind === 'validation') {
      return shareErrorResponse(resolved.error)
    }
    return new Response('Share link not found', { status: 404 })
  }

  const share = resolved

  const svg = buildOgSvg(share.result)
  const png = await renderOgPng(svg)
  return new Response(png, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
