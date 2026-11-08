# Offer Check
Browser-only demo that checks a job offer for scam signals (email, website, message text, community reports).
Run: `npm install && npm run dev`  ·  Build: `npm run build`  ·  Deploy: connect the repo to Vercel or Netlify (build `npm run build`, output `dist`).
All data (reports, history) stays in localStorage. Results are risk signals, not proof.

## Shared features (Supabase) and link reading (Vercel)
1. Create a free Supabase project, run `supabase/schema.sql` in the SQL editor.
2. Copy `.env.example` to `.env` and fill in the project URL and anon key (also add both as Vercel environment variables).
3. Link reading uses `api/extract.ts`, which only runs on Vercel (or `vercel dev` locally). Without keys, the app still works and shows where shared features need setup.
