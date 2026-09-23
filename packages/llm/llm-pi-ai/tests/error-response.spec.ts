import { afterEach, expect, it, vi } from 'vitest'
import { fetchWithErrorEnvelope } from '../src/error-response.ts'

afterEach(() => vi.unstubAllGlobals())

it.each([
  [200, 'text/event-stream', 'data: hello\n\n'],
  [503, 'text/plain', 'Unavailable'],
  [503, 'application/json', '{broken'],
  [503, 'application/json', '{"error":{"message":"unavailable"}}'],
  [503, 'application/json', '[]'],
  [503, 'application/json', '[null]'],
  [503, 'application/json', '[{"message":"unavailable"}]'],
])('preserves status %s and unchanged body %s %s', async (status, contentType, body) => {
  const original = new Response(body, { status, headers: { 'content-type': contentType } })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(original))
  const response = await fetchWithErrorEnvelope('https://provider.invalid')
  expect(response).toBe(original)
  expect(await response.text()).toBe(body)
})

it('preserves status and retry headers while replacing a compressed error envelope', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[{"error":{"message":"quota exceeded"}}]', {
    status: 429,
    headers: { 'content-type': 'application/json', 'content-length': '100', 'content-encoding': 'gzip', 'retry-after': '42' },
  })))
  const response = await fetchWithErrorEnvelope('https://provider.invalid')
  expect(response.status).toBe(429)
  expect(response.headers.get('retry-after')).toBe('42')
  expect(response.headers.has('content-length')).toBe(false)
  expect(response.headers.has('content-encoding')).toBe(false)
  expect(await response.json()).toEqual({ error: { message: 'quota exceeded' } })
})

it('does not hide a cancelled error-body read', async () => {
  const error = new DOMException('Cancelled', 'AbortError')
  const original = new Response('{}', { status: 503, headers: { 'content-type': 'application/json' } })
  vi.spyOn(original, 'clone').mockReturnValue({ json: () => Promise.reject(error) } as Response)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(original))
  await expect(fetchWithErrorEnvelope('https://provider.invalid')).rejects.toBe(error)
})
