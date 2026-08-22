/** Shared Pages Functions response/request helpers. */

export function jsonResponse(body: unknown, status = 200, cacheControl: 'no-store' | 'public, max-age=300' = 'no-store'): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cacheControl,
    },
  })
}

export function clientIp(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown'
  )
}

export type Env = {
  DB?: D1Database
  USE_LIVE_FIXTURES?: string
}

export type PagesContext = {
  request: Request
  env: Env
}
