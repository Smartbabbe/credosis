import { useEffect, useState } from 'react'
import type { Input } from './engine'
import { db, ensureListing, getComments, listingKey, postComment, searchCompany, type Comment, type RemoteReport } from './supa'
const inp = 'w-full rounded-md border border-line bg-white px-3 py-2'
const day = (d: string) => new Date(d).toLocaleDateString()
const Note = () => <p className="text-sm text-bark">Written by users and not verified by Offer Check.</p>
const List = ({ items }: { items: Comment[] }) => items.length ? <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-card">{items.map(c => <li key={c.id} className="p-3"><p className="font-medium">{c.author} <span className="text-sm font-normal text-bark">{day(c.created_at)}</span></p><p className="whitespace-pre-wrap">{c.body}</p></li>)}</ul> : <p className="mt-3 text-bark">No comments yet. Share what you know about this listing.</p>

export function Comments({ input, adUrl }: { input: Input; adUrl: string }) {
  const key = listingKey(input, adUrl)
  const [list, setList] = useState<Comment[]>([]); const [name, setName] = useState(''); const [body, setBody] = useState(''); const [msg, setMsg] = useState('')
  useEffect(() => { ensureListing(input, adUrl, key).then(() => getComments(key)).then(setList).catch(() => setMsg('Could not load comments.')) }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const post = async () => {
    if (body.trim().length < 2) return setMsg('Write a comment first.')
    if (Date.now() - Number(localStorage.getItem('oc_last') || 0) < 20000) return setMsg('Wait a few seconds before posting again.')
    const err = await postComment(key, name, body); if (err) return setMsg('Could not post: ' + err.message)
    localStorage.setItem('oc_last', String(Date.now())); setBody(''); setMsg(''); setList(await getComments(key))
  }
  return <div className="mt-8"><h2 className="font-display text-xl font-bold">What others say about this listing</h2><Note />
    {!db ? <p className="mt-3 rounded-md bg-line/50 p-3 text-bark">Comments need the shared database. Add your Supabase keys to turn this on.</p> : <>
      <div className="mt-3 space-y-2"><input aria-label="Your name" className={inp} value={name} onChange={e => setName(e.target.value)} placeholder="Name (optional)" maxLength={40} />
        <textarea aria-label="Comment" className={`${inp} h-24`} value={body} onChange={e => setBody(e.target.value)} placeholder="Did you apply? What happened?" maxLength={500} />
        <div className="flex items-center gap-3"><button onClick={post} className="rounded-md bg-moss px-4 py-2 font-medium text-card">Post comment</button><span role="status" className="text-sm text-rust">{msg}</span></div></div>
      <List items={list} /></>}</div>
}

export function Search() {
  const [q, setQ] = useState(''); const [res, setRes] = useState<{ listings: any[]; reports: RemoteReport[] } | null>(null); const [busy, setBusy] = useState(false)
  const go = async () => { setBusy(true); try { setRes(await searchCompany(q.trim())) } catch { setRes({ listings: [], reports: [] }) } setBusy(false) }
  return <section className="mt-8"><h2 className="font-display text-2xl font-bold">Search a company</h2><p className="text-bark">See reports and comments other people have left.</p><Note />
    {!db && <p className="mt-3 rounded-md bg-line/50 p-3 text-bark">Search needs the shared database. Add your Supabase keys to turn this on.</p>}
    <div className="mt-3 flex gap-2"><input aria-label="Company name" className={inp} value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && go()} placeholder="Company name or website" />
      <button onClick={go} disabled={busy || !q.trim()} className="rounded-md bg-moss px-4 py-2 font-medium text-card disabled:opacity-50">Search</button></div>
    {res && (res.listings.length + res.reports.length === 0 ? <p className="mt-4 text-bark">Nothing found for "{q}". That does not mean it is safe. It only means nobody has left anything yet.</p> : <>
      {res.reports.length > 0 && <div className="mt-6"><h3 className="font-display text-xl font-bold">Reports</h3><ul className="mt-2 divide-y divide-line rounded-lg border border-line bg-card">{res.reports.map(r => <li key={r.id} className="p-3"><p className="font-medium">{r.company || r.domain} <span className="text-sm font-normal text-bark">{day(r.created_at)}</span></p><p>{r.note || 'No details given'}</p>
        {r.evidence?.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{r.evidence.map(u => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="Evidence" className="h-20 w-20 rounded-md border border-line object-cover" /></a>)}</div>}</li>)}</ul></div>}
      {res.listings.map(l => <div key={l.key} className="mt-6"><h3 className="font-display text-xl font-bold">{l.company || l.key}</h3><p className="text-sm text-bark">{l.ad_url || l.website || l.key}</p><List items={l.comments} /></div>)}</>)}
  </section>
}

export function EvidenceFields({ files, setFiles }: { files: File[]; setFiles: (f: File[]) => void }) {
  const [err, setErr] = useState('')
  const pick = (l: FileList | null) => { const f = [...(l || [])].slice(0, 4); if (f.some(x => x.size > 3e6)) return setErr('Each image must be under 3 MB.'); setErr(''); setFiles(f) }
  return <div><span className="font-medium">Evidence</span><span className="ml-2 text-sm text-bark">Up to 4 screenshots. Hide your own phone number and bank details first.</span>
    <input type="file" accept="image/*" multiple onChange={e => pick(e.target.files)} className="mt-1 block w-full text-sm" />
    {files.length > 0 && <p className="mt-1 text-sm text-bark">{files.map(f => f.name).join(', ')}</p>}<p role="status" className="text-sm text-rust">{err}</p></div>
}
