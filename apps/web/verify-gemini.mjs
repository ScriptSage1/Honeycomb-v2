import fs from 'node:fs'
import { chromium } from 'playwright'
const log = fs.readFileSync('../../preview-honeycomb.log', 'utf8')
const url = log.match(/http:\/\/127\.0\.0\.1:4173\/\?token=\S+/)?.[0]
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
await page.goto(url)
await page.waitForTimeout(4000)
console.log('BEFORE:', await page.locator('body').innerText())
await page.getByText('Reply with exactly GEMINI_CONNECTION_OK.', { exact: true }).first().click({ timeout: 5000 }).catch(error => console.log(error.message))
await page.waitForTimeout(3000)
await page.waitForTimeout(2000)
await page.getByRole('button', { name: 'Stop generating', exact: true }).waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {})
console.log(await page.locator('body').innerText())
console.log(await page.locator('button').evaluateAll(items => items.map(item => ({ text: item.innerText, label: item.getAttribute('aria-label') }))))
await page.screenshot({ path: '../../gemini-app-check.png' })
await browser.close()

