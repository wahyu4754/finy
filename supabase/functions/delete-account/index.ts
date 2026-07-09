import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return err('Missing authorization', 401);

    const url  = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const svc  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify JWT — only the owner can delete their own account
    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return err('Unauthorized', 401);

    const uid   = user.id;
    const admin = createClient(url, svc);

    // 1. referral_uses has no ON DELETE CASCADE — must be removed first
    //    Delete rows where this user is the referrer OR the referred user
    const { error: ruErr } = await admin
      .from('referral_uses')
      .delete()
      .or(`referrer_id.eq.${uid},referred_user_id.eq.${uid}`);
    if (ruErr) console.warn('referral_uses cleanup:', ruErr.message);

    // 2. Delete public profile — cascades to wallets, transactions, categories,
    //    budgets, subscriptions, recurring_rules, referral_codes, etc.
    const { error: profileErr } = await admin.from('users').delete().eq('id', uid);
    if (profileErr) return err(profileErr.message, 500);

    // 3. Delete auth user (service role required)
    const { error: authDelErr } = await admin.auth.admin.deleteUser(uid);
    if (authDelErr) return err(authDelErr.message, 500);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return err(e?.message ?? 'Internal error', 500);
  }
});

function err(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
    status,
  });
}
