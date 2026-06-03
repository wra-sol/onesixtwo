import {
  shareValidationMessage,
  type ShareValidationError,
} from '../../src/lib/share-url'

export function shareErrorResponse(
  error: ShareValidationError,
  status = 400,
): Response {
  return new Response(shareValidationMessage(error), {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
