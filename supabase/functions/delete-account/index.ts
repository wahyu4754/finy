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

    // 1. Clean up referral_uses
    const { error: ruErr } = await admin
      .from('referral_uses')
      .delete()
      .or(`referrer_id.eq.${uid},referred_user_id.eq.${uid}`);
    if (ruErr) console.warn('referral_uses cleanup:', ruErr.message);

    // 2. Clean up transactions
    const { error: txErr } = await admin.from('transactions').delete().eq('user_id', uid);
    if (txErr) console.warn('transactions cleanup:', txErr.message);

    // 3. Clean up recurring_rules
    const { error: rrErr } = await admin.from('recurring_rules').delete().eq('user_id', uid);
    if (rrErr) console.warn('recurring_rules cleanup:', rrErr.message);

    // 4. Clean up budgets
    const { error: bgErr } = await admin.from('budgets').delete().eq('user_id', uid);
    if (bgErr) console.warn('budgets cleanup:', bgErr.message);

    // 5. Clean up categories
    const { error: catErr } = await admin.from('categories').delete().eq('user_id', uid);
    if (catErr) console.warn('categories cleanup:', catErr.message);

    // 6. Clean up wallets
    const { error: wlErr } = await admin.from('wallets').delete().eq('user_id', uid);
    if (wlErr) console.warn('wallets cleanup:', wlErr.message);

    // 7. Clean up subscriptions
    const { error: subErr } = await admin.from('subscriptions').delete().eq('user_id', uid);
    if (subErr) console.warn('subscriptions cleanup:', subErr.message);

    // 8. Delete public profile from users table
    const { error: profileErr } = await admin.from('users').delete().eq('id', uid);
    if (profileErr) return err(profileErr.message, 500);

    // 9. Delete auth user (service role required)
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
