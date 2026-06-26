import { onRequestLiveDraft } from '../_lib/live-api'

type PagesContext = Parameters<typeof onRequestLiveDraft>[0]

export async function onRequest(context: PagesContext): Promise<Response> {
  if (context.request.method === 'GET') {
    return onRequestLiveDraft(context)
  }
  return new Response('Method not allowed', { status: 405 })
}
