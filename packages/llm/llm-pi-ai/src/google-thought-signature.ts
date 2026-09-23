/**
 * Fill a missing Gemini 3 function-call thought signature before the request is sent.
 *
 * Gemini 3 rejects a follow-up when the first function call in a model turn has
 * no `thoughtSignature`. A signature the provider already stored is left as-is.
 * A missing one is Google's documented skip value, so a tool result can still
 * be sent after a call that arrived without a signature.
 *
 * @module dsh-llm-pi-ai/google-thought-signature
 */

/** Google's value for a function call that has no signature to echo. */
const SKIP_THOUGHT_SIGNATURE = 'skip_thought_signature_validator'

/** The model fields this fill needs from a pi-ai model descriptor. */
export interface ThoughtSignatureModel {
  /** pi-ai API name, such as `google-generative-ai`. */
  api: string
  /** Provider model id, with or without a `models/` prefix. */
  id: string
}

/**
 * Return the Google request payload, adding a skip signature only where Gemini 3 requires one.
 * @param payload - the provider request `onPayload` receives.
 * @param model - the model the request is about to call.
 * @returns the original payload, or a copy whose first unsigned function call in each turn carries the skip value.
 */
export function withGeminiFunctionCallSignature(payload: unknown, model: ThoughtSignatureModel): unknown {
  if (!isGemini3(model)) return payload
  if (!isRecord(payload) || !Array.isArray(payload['contents'])) return payload
  let changed = false
  const contents = payload['contents'].map(content => {
    if (!isRecord(content) || !Array.isArray(content['parts'])) return content
    let seenFunctionCall = false
    let partsChanged = false
    const parts = content['parts'].map(part => {
      if (!isRecord(part) || !isRecord(part['functionCall'])) return part
      const first = !seenFunctionCall
      seenFunctionCall = true
      if (!first || hasSignature(part['thoughtSignature'])) return part
      partsChanged = true
      changed = true
      return { ...part, thoughtSignature: SKIP_THOUGHT_SIGNATURE }
    })
    return partsChanged ? { ...content, parts } : content
  })
  return changed ? { ...payload, contents } : payload
}

/** Gemini 3 is the family that requires a thought signature on the first function call of a turn. */
function isGemini3(model: ThoughtSignatureModel): boolean {
  if (model.api !== 'google-generative-ai' && model.api !== 'google-vertex') return false
  const id = model.id.toLowerCase().replace(/^models\//, '')
  return /^gemini(?:-live)?-3(?:\D|$)/.test(id)
}

function hasSignature(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
