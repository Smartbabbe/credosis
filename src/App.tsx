import { useState, type ReactNode } from 'react'
import Intake, { type Fill } from './Intake'
import { Comments, EvidenceFields, Search } from './Community'
import { sendReport } from './supa'
import { analyze, host, root, SAMPLE_REAL, SAMPLE_SCAM, type Input, type Report, type Result, type Span, type Status } from './engine'

const load = <T,>(k: string): T[] => { try { return JSON.parse(localStorage.getItem(k) || '[]') } catch { return [] } }
const save = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* storage unavailable */ } }
const empty: Input = { company: '', website: '', email: '', text: '' }
const tone: Record<string, string> = { Low: 'text-moss', Medium: 'text-amber', High: 'text-rust', 'Not enough information': 'text-bark' }
const mark: Record<Status, { s: string; c: string }> = { pass: { s: '✓', c: 'bg-moss text-card' }, warn: { s: '!', c: 'bg-amber text-card' }, fail: { s: '✕', c: 'bg-rust text-card' }, unknown: { s: '?', c: 'bg-line text-ink' } }

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="block"><span className="font-medium">{label}</span>{hint && <span className="ml-2 text-sm text-bark">{hint}</span>}<div className="mt-1">{children}</div></label>
}
const box = 'w-full rounded-md border border-line bg-card px-3 py-2 text-ink placeholder:text-bark/60'
const btn = 'rounded-md px-4 py-2 font-medium transition-colors'

function Marked({ text, spans }: { text: string; spans: Span[] }) {
  const out: ReactNode[] = []; let i = 0
  ;[...spans].sort((a, b) => a.start - b.start).forEach((x, k) => { if (x.start < i) return; out.push(text.slice(i, x.start)); out.push(<mark key={k} title={x.cat} className="rounded-sm bg-rust/25 px-0.5 text-ink underline decoration-rust decoration-wavy">{text.slice(x.start, x.end)}</mark>); i = x.end })
  out.push(text.slice(i)); return <p className="whitespace-pre-wrap leading-relaxed">{out}</p>
}

export default function App() {
  const [view, setView] = useState<'check' | 'result' | 'report' | 'history' | 'search'>('check')
  const [input, setInput] = useState<Input>(empty)
  const [result, setResult] = useState<Result | null>(null)
  const [reports, setReports] = useState<Report[]>(() => load<Report>('oc_reports'))
  const [history, setHistory] = useState<Result[]>(() => load<Result>('oc_history'))
  const [note, setNote] = useState(''); const [rep, setRep] = useState({ company: '', site: '', note: '' }); const [msg, setMsg] = useState('')
  const [adUrl, setAdUrl] = useState(''); const [files, setFiles] = useState<File[]>([])
  const fill = (p: Fill) => { setAdUrl(p.adUrl || ''); setInput(v => ({ company: v.company || p.company || '', website: v.website || p.website || '', email: v.email || p.email || '', text: p.text ?? v.text })) }
  const set = (k: keyof Input) => (e: { target: { value: string } }) => setInput({ ...input, [k]: e.target.value })

  const run = () => { const r = analyze(input, reports); const h = [r, ...history].slice(0, 15); setResult(r); setHistory(h); save('oc_history', h); setView('result'); setMsg('') }
  const submitReport = () => {
    const d = rep.site ? root(host(rep.site)) : ''
    if (!rep.company.trim() && !d) { setMsg('Enter a company name or a website so the report can be matched later.'); return }
    const next = [{ id: String(Date.now()), company: rep.company.trim(), domain: d, note: rep.note.trim(), date: new Date().toISOString() }, ...reports]
    setReports(next); save('oc_reports', next); sendReport(rep, d, files).then(m => m && setMsg(m)); setFiles([]); setRep({ company: '', site: '', note: '' }); setMsg('Report saved. It will now count against matching listings.')
  }
  const copy = async () => {
    if (!result) return
    const lines = result.findings.filter(f => f.status === 'fail' || f.status === 'warn').map(f => `- ${f.label}: ${f.detail}`)
    const t = `Offer Check result for ${result.input.company || 'this offer'}: ${result.level} risk (score ${result.score}/100)\n${lines.join('\n') || '- No red flags found'}\nThis is a risk signal, not a guarantee.`
    try { await navigator.clipboard.writeText(t); setNote('Summary copied') } catch { setNote('Copy failed. Select the text manually.') }
  }
  const groups = result ? [...new Set(result.findings.map(f => f.group))] : []

  return <div className="mx-auto max-w-3xl px-4 pb-16">
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line py-6">
      <div><h1 className="font-display text-3xl font-bold">Job Checkers</h1><p className="text-bark">Paste a job offer. See what looks wrong before you reply.</p></div>
      <nav className="flex gap-1" aria-label="Main">{(['check', 'search', 'report', 'history'] as const).map(v => <button key={v} onClick={() => setView(v)} className={`${btn} ${view === v || (v === 'check' && view === 'result') ? 'bg-ink text-card' : 'text-ink hover:bg-line/60'}`}>{v === 'check' ? 'Check an offer' : v === 'search' ? 'Search companies' : v === 'report' ? 'Report a scam' : `History (${history.length})`}</button>)}</nav>
    </header>

    {view === 'check' && <section className="mt-8 space-y-5">
      <Intake onFill={fill} />
      <div className="flex flex-wrap items-center gap-2 text-sm"><span className="text-bark">Try an example:</span>
        <button className={`${btn} border border-line hover:bg-line/60`} onClick={() => setInput(SAMPLE_SCAM)}>Suspicious offer</button>
        <button className={`${btn} border border-line hover:bg-line/60`} onClick={() => setInput(SAMPLE_REAL)}>Legitimate offer</button></div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Company name"><input className={box} value={input.company} onChange={set('company')} placeholder="e.g. Brightfield Logistics" /></Field>
        <Field label="Company website"><input className={box} value={input.website} onChange={set('website')} placeholder="company.com" /></Field></div>
      <Field label="Recruiter email"><input className={box} type="email" value={input.email} onChange={set('email')} placeholder="name@company.com" /></Field>
      <Field label="Job message or ad" hint="Paste all of it. More text gives a better check."><textarea className={`${box} h-44`} value={input.text} onChange={set('text')} placeholder="Paste the WhatsApp message, email or job post here" /></Field>
      <div className="flex items-center gap-3"><button className={`${btn} bg-moss text-card hover:bg-moss/90`} onClick={run} disabled={!input.company && !input.website && !input.email && !input.text}>Check this offer</button>
        <button className={`${btn} text-bark hover:bg-line/60`} onClick={() => setInput(empty)}>Clear</button></div>
    </section>}

    {view === 'result' && result && <section className="mt-8">
      <div className="rounded-lg border border-line bg-card p-6">
        <p className="text-bark">{result.input.company || 'This offer'}</p>
        <p className={`font-display text-5xl font-bold ${tone[result.level]}`}>{result.level === 'Not enough information' ? 'Not enough to judge' : `${result.level} risk`}</p>
        <p className="mt-2 text-bark">Risk score {result.score}/100 · based on {result.confidence}% of the information a full check needs</p>
        {result.escalation && <p className="mt-3 rounded-md bg-rust/10 p-3 text-rust">{result.escalation}</p>}
        <p className="mt-3 text-sm text-bark">This is a risk signal, not proof. Confirm any employer through a channel you find yourself.</p>
        <div className="mt-4 flex flex-wrap items-center gap-2"><button className={`${btn} bg-ink text-card`} onClick={copy}>Copy result summary</button>
          <button className={`${btn} border border-line hover:bg-line/60`} onClick={() => { setRep({ company: result.input.company, site: result.input.website, note: '' }); setMsg(''); setView('report') }}>Report this offer</button>
          <button className={`${btn} text-bark hover:bg-line/60`} onClick={() => setView('check')}>Check another</button><span role="status" className="text-sm text-bark">{note}</span></div>
      </div>
      {result.input.text.trim().length >= 40 && <div className="mt-6"><h2 className="font-display text-xl font-bold">What the message says</h2><p className="mb-2 text-sm text-bark">Underlined phrases triggered a check. Hover for the reason.</p><div className="rounded-lg border border-line bg-card p-4"><Marked text={result.input.text} spans={result.spans} /></div></div>}
      {groups.map(g => <div key={g} className="mt-6"><h2 className="font-display text-xl font-bold">{g}</h2>
        <ul className="mt-2 divide-y divide-line rounded-lg border border-line bg-card">{result.findings.filter(f => f.group === g).map(f => <li key={f.id} className="flex gap-3 p-3">
          <span aria-label={f.status} className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${mark[f.status].c}`}>{mark[f.status].s}</span>
          <div><p className="font-medium">{f.label}</p><p className="text-sm text-bark">{f.detail}</p></div></li>)}</ul></div>)}
      <Comments input={result.input} adUrl={adUrl} />
    </section>}

    {view === 'search' && <Search />}

    {view === 'report' && <section className="mt-8 space-y-5"><h2 className="font-display text-2xl font-bold">Report a scam</h2>
      <p className="text-bark">Reports are saved in this browser. Later checks that match the company name or website will flag them.</p>
      <div className="grid gap-5 sm:grid-cols-2"><Field label="Company name"><input className={box} value={rep.company} onChange={e => setRep({ ...rep, company: e.target.value })} /></Field>
        <Field label="Website"><input className={box} value={rep.site} onChange={e => setRep({ ...rep, site: e.target.value })} /></Field></div>
      <Field label="What happened"><textarea className={`${box} h-28`} value={rep.note} onChange={e => setRep({ ...rep, note: e.target.value })} placeholder="e.g. Asked me to pay ₦10,000 for registration" /></Field>
      <EvidenceFields files={files} setFiles={setFiles} />
      <button className={`${btn} bg-moss text-card`} onClick={submitReport}>Save report</button><p role="status" className="text-bark">{msg}</p>
      {reports.length > 0 && <ul className="divide-y divide-line rounded-lg border border-line bg-card">{reports.map(r => <li key={r.id} className="p-3"><p className="font-medium">{r.company || r.domain}{r.company && r.domain ? ` (${r.domain})` : ''}</p><p className="text-sm text-bark">{r.note || 'No details given'} · {new Date(r.date).toLocaleDateString()}</p></li>)}</ul>}
    </section>}

    {view === 'history' && <section className="mt-8"><div className="flex items-center justify-between"><h2 className="font-display text-2xl font-bold">Recent checks</h2>
      {history.length > 0 && <button className={`${btn} text-bark hover:bg-line/60`} onClick={() => { setHistory([]); save('oc_history', []) }}>Clear history</button>}</div>
      {history.length === 0 ? <p className="mt-4 text-bark">Nothing here yet. Run a check and it will appear in this list.</p> :
        <ul className="mt-4 divide-y divide-line rounded-lg border border-line bg-card">{history.map(h => <li key={h.date}><button className="flex w-full items-center justify-between p-3 text-left hover:bg-line/40" onClick={() => { setResult(h); setInput(h.input); setView('result') }}>
          <span><span className="font-medium">{h.input.company || h.input.website || h.input.email || 'Pasted text'}</span><span className="block text-sm text-bark">{new Date(h.date).toLocaleString()}</span></span>
          <span className={`font-bold ${tone[h.level]}`}>{h.level === 'Not enough information' ? 'Unclear' : h.level}</span></button></li>)}</ul>}
    </section>}
  </div>
}
