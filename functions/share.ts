import { isShareBot } from './_lib/html'
import { resolveShareFromUrl } from './_lib/resolve-share'
import {
  buildBotShareHtml,
  injectShareMetaIntoHtml,
} from './_lib/share-html'

type PagesContext = {
  request: Request
  env: { ASSETS: { fetch: (request: Request) => Promise<Response> } }
  next: () => Promise<Response>
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const url = new URL(context.request.url)
  const share = resolveShareFromUrl(url)

  if (!share) {
    return new Response('Share link not found', { status: 404 })
  }

  const userAgent = context.request.headers.get('user-agent') ?? ''

  if (isShareBot(userAgent)) {
    return new Response(buildBotShareHtml(share), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    })
  }

  const indexRequest = new Request(
    new URL('/index.html', url.origin).toString(),
    context.request,
  )
  const indexResponse = await context.env.ASSETS.fetch(indexRequest)
  if (!indexResponse.ok) {
    return context.next()
  }

  const html = injectShareMetaIntoHtml(await indexResponse.text(), share)
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
