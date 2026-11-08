import { useState } from 'react'
import { host, type Input } from './engine'
export type Fill = Partial<Input> & { adUrl?: string }
const parse = (text: string, adUrl: string, site = ''): Fill => {
  const email = text.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/)?.[0]
  const web = (text.match(/\bhttps?:\/\/[^\s"'<>)]+/gi) || []).find(u => host(u) && host(u) !== host(adUrl))
  const company = text.match(/(?:company|employer|organi[sz]ation)\s*[:\-]\s*([^\n.]{2,50})/i)?.[1]?.trim() || site
  return { text, adUrl, ...(email && { email }), ...(web && { website: web }), ...(company && { company }) }
}
export default function Intake({ onFill }: { onFill: (p: Fill) => void }) {
  const [link, setLink] = useState(''); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('')
  const fromLink = async () => {
    setBusy(true); setMsg('Reading the page...')
    try { const r = await fetch('/api/extract?url=' + encodeURIComponent(link.trim())); const d = await r.json(); if (!r.ok) throw new Error(d.error); onFill(parse(d.text, link.trim(), d.site)); setMsg('Details filled in. Check them, then run the check.') }
    catch (e) { setMsg((e as Error).message || 'Could not read that link. Paste the ad text instead.') } finally { setBusy(false) }
  }
  const fromImage = async (f?: File) => {
    if (!f) return; setBusy(true); setMsg('Reading the picture. The first time can take a minute...')
    try { const { recognize } = await import('tesseract.js'); const { data } = await recognize(f, 'eng'); if (data.text.trim().length < 20) throw new Error('No readable text found. Try a sharper screenshot.'); onFill(parse(data.text.trim(), '')); setMsg('Text read from the picture. Fix any mistakes before checking.') }
    catch (e) { setMsg((e as Error).message || 'Could not read the picture.') } finally { setBusy(false) }
  }
  return <div className="rounded-lg border border-line bg-card p-4"><p className="font-medium">Start from the ad itself</p>
    <div className="mt-2 flex flex-wrap gap-2"><input aria-label="Ad link" className="min-w-0 flex-1 rounded-md border border-line bg-white px-3 py-2" value={link} onChange={e => setLink(e.target.value)} placeholder="Paste the ad link, https://..." />
      <button disabled={busy || !link.trim()} onClick={fromLink} className="rounded-md bg-moss px-4 py-2 font-medium text-card disabled:opacity-50">Read link</button>
      <label className="cursor-pointer rounded-md border border-line bg-white px-4 py-2 font-medium hover:bg-line/50">Upload a picture<input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={e => fromImage(e.target.files?.[0])} /></label></div>
    <p role="status" className="mt-2 text-sm text-bark">{msg || 'Public job pages work best. Facebook, WhatsApp and Telegram links are usually blocked, so upload a screenshot instead.'}</p></div>
}
