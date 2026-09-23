import fs from 'node:fs'
import yaml from 'js-yaml'
const home = process.env.USERPROFILE + '/.dsh'
const settings = yaml.load(fs.readFileSync(home + '/settings.yaml', 'utf8'))
const config = settings['llm-pi-ai'].providers.gemini
const credentials = yaml.load(fs.readFileSync(home + '/.credentials.yaml', 'utf8'))
const key = process.env[config.apiKeyEnv] ?? credentials.refs?.[config.apiKeyEnv]
if (typeof key !== 'string') throw Error('Configured Gemini credential could not be resolved')
console.log(JSON.stringify({ baseURL: config.baseURL, api: config.api, compat: config.compat }))
for (const model of process.argv.slice(2).length ? process.argv.slice(2) : ['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.8-flash']) {
 try {
  const native = process.env.GEMINI_TEST_NATIVE === '1'
  const endpoint = native ? `https://generativelanguage.googleapis.com/v1beta/models/${model.replace(/^models\//, '')}:generateContent` : config.baseURL.replace(/\/$/, '') + '/chat/completions'
  const response = await fetch(endpoint, {
    method: 'POST', headers: native ? { 'x-goog-api-key': key, 'Content-Type': 'application/json' } : { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify(native ? { contents: [{ parts: [{ text: 'Reply with OK.' }] }], generationConfig: { maxOutputTokens: 256 } } : { model, messages: [{ role: 'user', content: 'Reply with OK.' }], max_completion_tokens: Number(process.env.GEMINI_TEST_BUDGET ?? 256) }),
    signal: AbortSignal.timeout(25000),
  })
  const body = await response.text()
  let result
  try { const parsed = JSON.parse(body); result = response.ok ? { content: parsed.choices?.[0]?.message?.content ?? parsed.candidates?.[0]?.content, usage: parsed.usage ?? parsed.usageMetadata } : parsed } catch { result = body.slice(0,1600) }
  console.log(JSON.stringify({ model, status: response.status, result }).replaceAll(key, '[redacted]'))
 } catch (error) { console.log(JSON.stringify({model, error: error.message.replaceAll(key, '[redacted]')})) }
}
