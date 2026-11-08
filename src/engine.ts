export type Status = 'pass' | 'warn' | 'fail' | 'unknown'
export interface Finding { id: string; group: string; label: string; status: Status; weight: number; detail: string }
export interface Input { company: string; website: string; email: string; text: string }
export interface Span { start: number; end: number; cat: string }
export interface Report { id: string; company: string; domain: string; note: string; date: string }
export interface Result { level: 'Low' | 'Medium' | 'High' | 'Not enough information'; score: number; confidence: number; findings: Finding[]; spans: Span[]; input: Input; date: string; escalation?: string }

const FREE = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'proton.me', 'icloud.com', 'aol.com']
const RISKY_TLD = ['xyz', 'top', 'click', 'work', 'site', 'online', 'buzz', 'icu', 'live', 'shop', 'cfd', 'sbs', 'rest']
const SHORT = ['bit.ly', 'tinyurl.com', 't.co', 'cutt.ly', 'rb.gy', 'is.gd', 'wa.me']
const FREEHOST = ['wixsite.com', 'blogspot.com', 'weebly.com', 'wordpress.com', 'linktr.ee', 'carrd.co', 'godaddysites.com', 'sites.google.com', 'notion.site', 'github.io', 'vercel.app', 'netlify.app']
const BRANDS = ['google', 'microsoft', 'amazon', 'linkedin', 'paystack', 'flutterwave', 'andela', 'dangote', 'shell', 'chevron', 'mtn', 'airtel', 'deloitte', 'unilever', 'meta', 'upwork']

export const host = (u: string) => { try { return new URL(/^https?:\/\//i.test(u) ? u : 'https://' + u).hostname.replace(/^www\./, '').toLowerCase() } catch { return '' } }
export const root = (h: string) => { const p = h.split('.'); return p.length > 2 && /^(co|com|org|net|gov|edu)$/.test(p[p.length - 2]) ? p.slice(-3).join('.') : p.slice(-2).join('.') }
const lev = (a: string, b: string) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length] }
const squash = (s: string) => s.toLowerCase().replace(/rn/g, 'm').replace(/vv/g, 'w').replace(/0/g, 'o').replace(/[1|]/g, 'l').replace(/[^a-z]/g, '')
const plain = (s: string) => s.toLowerCase().replace(/\b(ltd|limited|inc|llc|plc|company|co|group|nigeria|careers|recruitment)\b/g, '').replace(/[^a-z0-9]/g, '')

const PATTERNS: [string, string, number, RegExp][] = [
  ['fee', 'Asks for money upfront', 40, /\b(registration|training|application|processing|admin(istrative)?|onboarding|verification|activation|uniform|equipment|starter kit)\s+(fee|charge|payment|deposit)s?\b|\brefundable\s+(deposit|fee)\b|\bpay\s+(a\s+)?(small\s+)?(fee|deposit)\b/gi],
  ['data', 'Asks for sensitive data early', 25, /\b(bvn|nin|bank\s+(account|details)|atm\s+(card|pin)|passport|driver'?s\s+licen[cs]e|otp|password)\b/gi],
  ['cheque', 'Cheque or equipment-purchase scheme', 30, /\b(cheque|check)\b.{0,40}\b(deposit|cash|send\s+back)\b|\bpurchase\s+(your\s+own\s+)?(laptop|equipment|software)\b|\bwe\s+will\s+reimburse\b|\bgift\s+cards?\b/gi],
  ['offsite', 'Moves the conversation to Telegram or WhatsApp', 18, /\b(interview|chat|contact|message|dm)\b.{0,40}\b(telegram|whatsapp)\b|\b(telegram|whatsapp)\b.{0,30}\b(only|interview)\b/gi],
  ['nointerview', 'Promises a job with no real hiring process', 15, /\b(no\s+interview|no\s+experience\s+(needed|required)|hired\s+(instantly|immediately|on\s+the\s+spot)|guaranteed\s+(job|income|salary|pay))\b/gi],
  ['urgency', 'Pressure to act quickly', 10, /\b(urgent(ly)?|act\s+now|limited\s+(slots|spots)|apply\s+today|hurry|expires?\s+(today|soon)|first\s+\d+\s+(applicants|people))\b/gi],
]
const PAY = /(₦|#|ngn|\$|usd)\s?([\d,]+(?:\.\d+)?)\s?(k)?\s*(?:per|a|\/)\s*(day|daily|hour|hr|week|weekly)/gi

const F = (id: string, group: string, label: string, status: Status, weight: number, detail: string): Finding => ({ id, group, label, status, weight, detail })

export function analyze(input: Input, reports: Report[]): Result {
  const { company, website, email, text } = input
  const findings: Finding[] = [], spans: Span[] = []
  const eDom = email.includes('@') ? email.split('@')[1].trim().toLowerCase() : ''
  const wHost = host(website), wRoot = wHost && root(wHost), eRoot = eDom && root(eDom)

  // Email
  if (!eDom) findings.push(F('e', 'Email', 'Recruiter email', 'unknown', 0, 'No email entered, so these checks were skipped.'))
  else {
    const free = FREE.includes(eDom)
    findings.push(F('free', 'Email', 'Uses a company email domain', free ? 'warn' : 'pass', 12, free ? `${eDom} is a free provider. Real companies usually email from their own domain.` : `Email comes from ${eDom}.`))
    const lbl = eRoot.split('.')[0], sq = squash(lbl)
    const fake = BRANDS.find(b => (sq === b && lbl !== b) || (lev(sq, b) <= 1 && sq !== b && b.length > 5))
    findings.push(F('look', 'Email', 'Not a lookalike of a known brand', fake ? 'fail' : 'pass', 30, fake ? `${eRoot} looks like "${fake}" with characters swapped.` : 'No lookalike pattern found.'))
    if (!free && company) { const sim = 1 - lev(plain(company), squash(lbl)) / Math.max(plain(company).length, lbl.length, 1); const ok = sim >= 0.55 || lbl.includes(plain(company)) || plain(company).includes(lbl); findings.push(F('match', 'Email', 'Email domain fits the company name', ok ? 'pass' : 'warn', 10, ok ? 'Domain and company name are consistent.' : `"${company}" and ${eRoot} do not look related.`)) }
    const tld = eDom.split('.').pop()!; findings.push(F('etld', 'Email', 'Domain ending is common', RISKY_TLD.includes(tld) ? 'warn' : 'pass', 8, RISKY_TLD.includes(tld) ? `.${tld} domains are cheap and often used in scams.` : `.${tld} is a normal ending.`))
  }
  // Website
  if (!wHost) findings.push(F('w', 'Website', 'Company website', 'unknown', 0, 'No website entered. A real employer usually has one.'))
  else {
    const https = /^http:\/\//i.test(website), short = SHORT.includes(wHost), fh = FREEHOST.find(h => wHost.endsWith(h)), ip = /^\d+\.\d+\.\d+\.\d+$/.test(wHost), puny = wHost.includes('xn--')
    findings.push(F('https', 'Website', 'Secure connection (HTTPS)', https ? 'warn' : 'pass', 8, https ? 'The link uses plain http.' : 'No problem found.'))
    findings.push(F('short', 'Website', 'Direct link, not a shortener or IP', short || ip || puny ? 'fail' : 'pass', 15, short ? 'Shortened links hide the real destination.' : ip ? 'The link is a bare IP address.' : puny ? 'The domain uses disguised characters (punycode).' : 'Link points straight to a domain.'))
    findings.push(F('host', 'Website', 'Own domain, not a free site builder', fh ? 'warn' : 'pass', 12, fh ? `Hosted on ${fh}, which anyone can set up in minutes.` : 'Has its own domain.'))
    findings.push(F('wtld', 'Website', 'Domain looks plain', wHost.split('.').length > 4 || (wHost.match(/-/g) || []).length > 2 || RISKY_TLD.includes(wHost.split('.').pop()!) ? 'warn' : 'pass', 7, 'Checks for many subdomains, hyphens and cheap endings.'))
    if (eRoot) findings.push(F('same', 'Website', 'Website and email share a domain', eRoot === wRoot || FREE.includes(eDom) ? (FREE.includes(eDom) ? 'unknown' : 'pass') : 'fail', 15, eRoot === wRoot ? 'They match.' : FREE.includes(eDom) ? 'Skipped because the email is a free provider.' : `Email uses ${eRoot} but the site is ${wRoot}.`))
  }
  // Job text
  if (text.trim().length < 40) findings.push(F('t', 'Job text', 'Job description', 'unknown', 0, 'Paste the full message or ad for a text check.'))
  else {
    for (const [id, label, weight, re] of PATTERNS) {
      const m = [...text.matchAll(re)]; m.forEach(x => spans.push({ start: x.index!, end: x.index! + x[0].length, cat: label }))
      findings.push(F(id, 'Job text', label, m.length ? 'fail' : 'pass', weight, m.length ? `Found: ${m.slice(0, 3).map(x => `"${x[0]}"`).join(', ')}` : 'Nothing found.'))
    }
    const pays = [...text.matchAll(PAY)].filter(x => { const n = parseFloat(x[2].replace(/,/g, '')) * (x[3] ? 1000 : 1), usd = /\$|usd/i.test(x[1]) ? n : n / 1500, per = /hour|hr/i.test(x[4]) ? 8 : /week/i.test(x[4]) ? 0.2 : 1; return usd * per >= 100 })
    pays.forEach(x => spans.push({ start: x.index!, end: x.index! + x[0].length, cat: 'Unrealistic pay' }))
    findings.push(F('pay', 'Job text', 'Pay is believable', pays.length ? 'fail' : 'pass', 18, pays.length ? `"${pays[0][0]}" is far above normal for a remote entry role.` : 'No unusual pay claims.'))
  }
  // Community reports
  const hits = reports.filter(r => (r.domain && (r.domain === eRoot || r.domain === wRoot)) || (company && r.company.toLowerCase() === company.trim().toLowerCase()))
  findings.push(F('rep', 'Community', 'Not reported by others', hits.length ? 'fail' : 'pass', 35, hits.length ? `${hits.length} earlier report${hits.length > 1 ? 's' : ''} match this company or domain.` : 'No earlier reports on this device.'))

  // Score, escalation, confidence
  const fired = findings.filter(f => f.status === 'fail' || f.status === 'warn')
  let score = Math.min(100, fired.reduce((s, f) => s + (f.status === 'warn' ? f.weight * 0.7 : f.weight), 0))
  const has = (id: string) => findings.some(f => f.id === id && f.status === 'fail')
  let escalation: string | undefined
  if (has('fee') && (has('offsite') || has('data'))) { score = Math.max(score, 85); escalation = 'An upfront fee combined with Telegram-only contact or a request for personal data is the most common scam pattern.' }
  else if (hits.length >= 2) { score = Math.max(score, 80); escalation = 'Several people have reported this company or domain.' }
  const confidence = (eDom ? 25 : 0) + (wHost ? 25 : 0) + (text.trim().length > 200 ? 40 : text.trim().length >= 40 ? 20 : 0) + (company ? 10 : 0)
  const level = confidence < 40 && score < 45 ? 'Not enough information' : score < 20 ? 'Low' : score < 45 ? 'Medium' : 'High'
  return { level, score: Math.round(score), confidence, findings, spans, input, date: new Date().toISOString(), escalation }
}

export const SAMPLE_SCAM: Input = { company: 'Globalink Careers', website: 'globalink-careers.wixsite.com/jobs', email: 'hr.globalink2024@gmail.com', text: 'URGENT: Remote customer support agents needed. No experience required, guaranteed income of ₦300,000 per week. Limited slots, apply today! A refundable registration fee of ₦15,000 secures your slot. Interviews hold on Telegram only. Send your BVN and bank details to get started.' }
export const SAMPLE_REAL: Input = { company: 'Brightfield Logistics', website: 'https://brightfieldlogistics.com/careers', email: 'careers@brightfieldlogistics.com', text: 'Brightfield Logistics is hiring a Dispatch Coordinator in Lagos. You will plan daily delivery routes, update our tracking system and report to the Operations Manager. We ask for 2 years of logistics experience and good Excel skills. Salary is ₦250,000 monthly. Apply through our careers page. Shortlisted candidates will have two interviews on Google Meet, and we never ask candidates for payment.' }
