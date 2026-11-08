// Vercel serverless function: reads a public ad page and returns its text.
export default async function handler(req: any, res: any) {
  let url: URL
  try { url = new URL(String(req.query.url || '')) } catch { return res.status(400).json({ error: 'Enter a full link starting with https://' }) }
  if (!/^https?:$/.test(url.protocol) || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[)/i.test(url.hostname)) return res.status(400).json({ error: 'That link cannot be read.' })
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { 'user-agent': 'Mozilla/5.0 OfferCheck', accept: 'text/html' } })
    if (!r.ok) return res.status(422).json({ error: `The site refused the request (${r.status}). Paste the ad text instead.` })
    const html = (await r.text()).slice(0, 600000)
    const meta = (p: string) => html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']+)`, 'i'))?.[1] || ''
    const title = html.match(/<title[^>]*>([^<]*)/i)?.[1]?.trim() || ''
    const body = html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 6000)
    if (body.length < 80) return res.status(422).json({ error: 'That page has no readable text (it may need a login). Paste the ad text instead.' })
    res.json({ title, site: meta('og:site_name'), text: `${title}. ${meta('og:description')} ${body}`.trim() })
  } catch { res.status(502).json({ error: 'Could not open that link. Paste the ad text instead.' }) }
}
