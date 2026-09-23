import { describe, expect, it } from 'vitest'
import { withGeminiFunctionCallSignature } from '../src/google-thought-signature.ts'

const gemini3 = { api: 'google-generative-ai', id: 'models/gemini-3.8-flash' }

describe('withGeminiFunctionCallSignature', () => {
  it('fills the first unsigned Gemini 3 function call and leaves a stored signature', () => {
    const payload = {
      model: 'models/gemini-3.8-flash',
      contents: [{
        role: 'model',
        parts: [
          { functionCall: { name: 'write', args: { file_path: 'calculator.html' } } },
          { functionCall: { name: 'read', args: {} }, thoughtSignature: 'already-signed' },
        ],
      }],
    }
    expect(withGeminiFunctionCallSignature(payload, gemini3)).toEqual({
      model: 'models/gemini-3.8-flash',
      contents: [{
        role: 'model',
        parts: [
          {
            functionCall: { name: 'write', args: { file_path: 'calculator.html' } },
            thoughtSignature: 'skip_thought_signature_validator',
          },
          { functionCall: { name: 'read', args: {} }, thoughtSignature: 'already-signed' },
        ],
      }],
    })
    expect(payload.contents[0]?.parts[0]).not.toHaveProperty('thoughtSignature')
  })

  it('leaves a signed first call and later unsigned calls unchanged', () => {
    const payload = {
      contents: [{
        role: 'model',
        parts: [
          { functionCall: { name: 'write' }, thoughtSignature: 'real-signature' },
          { functionCall: { name: 'read' } },
        ],
      }],
    }
    expect(withGeminiFunctionCallSignature(payload, gemini3)).toBe(payload)
  })

  it('ignores Gemini 2 and non-Google payloads', () => {
    const payload = { contents: [{ parts: [{ functionCall: { name: 'write' } }] }] }
    expect(withGeminiFunctionCallSignature(payload, { api: 'google-generative-ai', id: 'gemini-2.5-flash' })).toBe(payload)
    expect(withGeminiFunctionCallSignature(payload, { api: 'openai-completions', id: 'models/gemini-3.8-flash' })).toBe(payload)
    expect(withGeminiFunctionCallSignature('not-json', gemini3)).toBe('not-json')
  })
})
