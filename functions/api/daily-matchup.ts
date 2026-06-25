import { onRequest } from '../_lib/live-api'

type PagesContext = Parameters<typeof onRequest>[0]

export async function onRequest(context: PagesContext): Promise<Response> {
  if (context.request.method === 'GET') {
    return onRequest(context)
  }
  return new Response('Method not allowed', { status: 405 })
}
