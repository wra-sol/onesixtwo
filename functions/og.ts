import { buildOgSvg } from './_lib/og-image'
import { resolveShareFromUrl } from './_lib/resolve-share'

type PagesContext = {
  request: Request
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const url = new URL(context.request.url)
  const share = resolveShareFromUrl(url)

  if (!share) {
    return new Response('Invalid share parameters', { status: 400 })
  }

  const svg = buildOgSvg(share.result, share.lineup)
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
