/** Preserve singleton error envelopes returned by OpenAI-compatible gateways. */

/**
 * Google returns `[ { error: ... } ]` on its compatibility endpoint. OpenAI's
 * SDK discards that envelope and reports "no body", hiding quota exhaustion.
 * Successful streams and other error shapes pass through unchanged.
 * @param input - provider request target.
 * @param init - provider request options, including cancellation and headers.
 * @returns the response with a singleton error array unwrapped for the SDK.
 */
export async function fetchWithErrorEnvelope(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> {
  const response = await fetch(input, init)
  if (response.ok || !response.headers.get('content-type')?.includes('application/json')) return response
  let body: unknown
  try {
    body = await response.clone().json()
  } catch (error) {
    // Non-JSON error pages retain the SDK's ordinary HTTP error handling.
    if (error instanceof SyntaxError) return response
    throw error
  }
  if (!Array.isArray(body) || body.length !== 1) return response
  const envelope: unknown = body[0]
  if (typeof envelope !== 'object' || envelope === null || !('error' in envelope)) return response
  const headers = new Headers(response.headers)
  headers.delete('content-length')
  headers.delete('content-encoding')
  return new Response(JSON.stringify(envelope), { status: response.status, statusText: response.statusText, headers })
}
