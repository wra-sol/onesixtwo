type CacheStorageWithDefault = CacheStorage & {
  default?: Cache
}

type CacheableResponse = () => Promise<Response> | Response

const CACHE = (globalThis.caches as CacheStorageWithDefault | undefined)?.default

function buildCacheRequest(url: URL): Request {
  const key = new URL(url)
  key.searchParams.sort()
  return new Request(key.toString(), { method: 'GET' })
}

export async function respondWithEdgeCache(
  url: URL,
  buildResponse: CacheableResponse,
): Promise<Response> {
  const cache = CACHE
  if (!cache) {
    return buildResponse()
  }

  const cacheRequest = buildCacheRequest(url)
  const cached = await cache.match(cacheRequest)
  if (cached) {
    return cached
  }

  const response = await buildResponse()
  if (response.ok) {
    await cache.put(cacheRequest, response.clone())
  }
  return response
}
