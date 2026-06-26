import { onRequestSim162Live } from '../_lib/live-api'

type PagesContext = Parameters<typeof onRequestSim162Live>[0]

export async function onRequest(context: PagesContext): Promise<Response> {
  if (context.request.method === 'GET') {
    return onRequestSim162Live(context)
  }
  return new Response('Method not allowed', { status: 405 })
}
