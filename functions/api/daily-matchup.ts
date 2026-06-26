import { onRequest as handleDailyMatchupRequest } from '../_lib/live-api'

type PagesContext = Parameters<typeof handleDailyMatchupRequest>[0]

export async function onRequest(context: PagesContext): Promise<Response> {
  if (context.request.method === 'GET') {
    return handleDailyMatchupRequest(context)
  }
  return new Response('Method not allowed', { status: 405 })
}
