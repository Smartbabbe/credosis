import { createClient } from '@supabase/supabase-js'
import { host, root, type Input } from './engine'
export const db = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY) : null
export interface Comment { id: string; listing_key: string; author: string; body: string; created_at: string }
export interface RemoteReport { id: string; company: string; domain: string; note: string; evidence: string[]; created_at: string }
export const listingKey = (i: Input, adUrl: string) => {
  if (adUrl) { try { const u = new URL(adUrl); return (u.hostname + u.pathname).toLowerCase().replace(/\/$/, '') } catch { /* fall through */ } }
  return (root(host(i.website)) || (i.email.split('@')[1] ? root(i.email.split('@')[1].toLowerCase()) : '') || i.company.trim().toLowerCase() || 'unknown')
}
export const ensureListing = async (i: Input, adUrl: string, key: string) => { if (db) await db.from('listings').upsert({ key, company: i.company, website: i.website, email: i.email, ad_url: adUrl || null }, { onConflict: 'key', ignoreDuplicates: true }) }
export const getComments = async (key: string): Promise<Comment[]> => db ? (await db.from('comments').select('*').eq('listing_key', key).order('created_at', { ascending: false }).limit(50)).data ?? [] : []
export const postComment = async (key: string, author: string, body: string) => (await db!.from('comments').insert({ listing_key: key, author: author.trim() || 'Anonymous', body: body.trim() })).error
export async function sendReport(r: { company: string; site: string; note: string }, domain: string, files: File[]): Promise<string | null> {
  if (!db) return 'Saved on this device only. Connect Supabase to share reports and evidence.'
  try {
    const evidence: string[] = []
    for (const f of files.slice(0, 4)) { const p = `${crypto.randomUUID()}-${f.name.replace(/[^\w.]/g, '_')}`; const { error } = await db.storage.from('evidence').upload(p, f); if (!error) evidence.push(db.storage.from('evidence').getPublicUrl(p).data.publicUrl) }
    const { error } = await db.from('reports').insert({ listing_key: domain || r.company.toLowerCase(), company: r.company, domain, note: r.note, evidence })
    return error ? 'Saved on this device, but sharing failed: ' + error.message : `Report shared with ${evidence.length} evidence image${evidence.length === 1 ? '' : 's'}.`
  } catch { return 'Saved on this device, but sharing failed. Check your connection.' }
}
export async function searchCompany(q: string) {
  if (!db || !q) return { listings: [] as any[], reports: [] as RemoteReport[] }
  const like = `%${q.replace(/[%,()]/g, '')}%`
  const [l, r] = await Promise.all([db.from('listings').select('*').ilike('company', like).limit(10), db.from('reports').select('*').or(`company.ilike.${like},domain.ilike.${like}`).order('created_at', { ascending: false }).limit(20)])
  const ls = l.data ?? []
  const c: Comment[] = ls.length ? (await db.from('comments').select('*').in('listing_key', ls.map((x: any) => x.key)).order('created_at', { ascending: false }).limit(50)).data ?? [] : []
  return { listings: ls.map((x: any) => ({ ...x, comments: c.filter(y => y.listing_key === x.key) })), reports: (r.data ?? []) as RemoteReport[] }
}
