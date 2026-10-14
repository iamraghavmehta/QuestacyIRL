import { createClient } from 'npm:@supabase/supabase-js@2';
import { createHash } from 'node:crypto';
const cors = (origin: string) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin', 'Content-Type': 'application/json'
});
const json = (body: unknown, status: number, origin: string) => new Response(JSON.stringify(body), { status, headers: cors(origin) });
const validEmail = (v: unknown) => typeof v === 'string' && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
Deno.serve(async (req) => {
  const origin = req.headers.get('origin') ?? '';
  const allowedOrigin = Deno.env.get('SITE_ORIGIN') ?? '';
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(allowedOrigin || origin) });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, allowedOrigin || origin);
  if (!allowedOrigin || origin !== allowedOrigin) return json({ error: 'Origin not allowed.' }, 403, allowedOrigin || origin);
  try {
    const body = await req.json();
    if (body.website) return json({ ok: true }, 200, allowedOrigin); // honeypot: don't store bot submissions
    const email = String(body.email ?? '').trim().toLowerCase();
    const name = String(body.name ?? '').trim();
    const userType = String(body.user_type ?? '').trim();
    if (!validEmail(email)) return json({ error: 'Enter a valid email address.' }, 400, allowedOrigin);
    if (body.consent !== true) return json({ error: 'Consent is required.' }, 400, allowedOrigin);
    if (name.length > 80 || userType.length > 40) return json({ error: 'One of the fields is too long.' }, 400, allowedOrigin);
    const url = Deno.env.get('SUPABASE_URL')!;
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY');
    if (!url || !key) throw new Error('Server configuration is incomplete.');
    const db = createClient(url, key, { auth: { persistSession: false } });
    const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const ipHash = createHash('sha256').update(`${Deno.env.get('RATE_LIMIT_SALT') ?? 'questacy'}:${ip}`).digest('hex');
    const { data: allowed, error: rateError } = await db.rpc('consume_form_rate_limit', { p_form_key: 'early-access-signup', p_ip_hash: ipHash });
    if (rateError) throw rateError;
    if (allowed !== true) return json({ error: 'Too many attempts. Please wait an hour before trying again.' }, 429, allowedOrigin);
    const { error } = await db.from('early_access_signups').insert({ email, first_name: name || null, user_type: userType || null, consent: true, consent_at: new Date().toISOString() });
    if (error?.code === '23505') return json({ error: 'This email is already on the list.', code: 'duplicate' }, 409, allowedOrigin);
    if (error) throw error;
    return json({ ok: true }, 201, allowedOrigin);
  } catch (err) {
    console.error('early-access-signup failed', err);
    return json({ error: 'We could not save your registration right now. Please try again later.' }, 500, Deno.env.get('SITE_ORIGIN') ?? origin);
  }
});
