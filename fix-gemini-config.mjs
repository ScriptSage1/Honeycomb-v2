import fs from 'node:fs'
import yaml from 'js-yaml'
const path = process.env.USERPROFILE + '/.dsh/settings.yaml'
const original = fs.readFileSync(path, 'utf8')
const settings = yaml.load(original)
const provider = settings['llm-pi-ai']?.providers?.gemini
if (provider?.baseURL !== 'https://generativelanguage.googleapis.com/v1beta/openai/') throw Error('Unexpected Gemini endpoint')
provider.compat = { ...provider.compat, supportsStore: false }
fs.copyFileSync(path, path + '.before-gemini-fix-' + Date.now())
fs.writeFileSync(path, yaml.dump(settings, { lineWidth: -1, noRefs: true }))
console.log('Gemini supportsStore disabled; settings backup saved. Credentials unchanged.')
