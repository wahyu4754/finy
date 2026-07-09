// supabase/functions/create-subscription/index.ts
// Creates a Midtrans Snap token for Finy Pro subscription payments (Web/PWA)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ─── Security: max body size ─────────────────────────────────────────
const MAX_BODY_SIZE = 10 * 1024; // 10 KB (tiny JSON payload)

// ─── Plan Configuration ─────────────────────────────────────────────
const PLANS: Record<string, { label: string; amount: number; durationDays: number }> = {
  monthly: { label: 'Finy Pro Bulanan', amount: 14999, durationDays: 30 },
  annual:  { label: 'Finy Pro Tahunan', amount: 119999, durationDays: 365 },
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    // ── Auth: extract user from JWT ──────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonError('Missing authorization header', 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify the user's JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return jsonError('Unauthorized', 401);
    }

    // ── H-3: Rate limiting (strict — prevents order spam) ────────
    const { data: allowed } = await userClient.rpc('check_rate_limit', {
      p_action: 'create-subscription',
      p_max: 5,
      p_window_minutes: 10,
    });
    if (!allowed) {
      return jsonError('Terlalu banyak permintaan. Coba lagi nanti.', 429);
    }

    // ── Parse request body ───────────────────────────────────────
    const body = await req.json();
    const plan = body.plan as string;

    if (!plan || !PLANS[plan]) {
      return jsonError('Invalid plan. Use "monthly" or "annual".', 400);
    }

    const planConfig = PLANS[plan];

    // ── Fetch user profile ───────────────────────────────────────
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile } = await adminClient
      .from('users')
      .select('name, email')
      .eq('id', user.id)
      .single();

    // ── M-7: Generate unique order ID (random, no user ID leak) ──
    const orderId = `FINY-${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

    // ── Create Midtrans Snap token ───────────────────────────────
    const midtransServerKey = Deno.env.get('MIDTRANS_SERVER_KEY');
    if (!midtransServerKey) {
      return jsonError('MIDTRANS_SERVER_KEY is not configured', 500);
    }

    const isProduction = Deno.env.get('MIDTRANS_PRODUCTION') === 'true';
    const snapUrl = isProduction
      ? 'https://app.midtrans.com/snap/v1/transactions'
      : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

    const authString = btoa(`${midtransServerKey}:`);

    const midtransPayload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: planConfig.amount,
      },
      item_details: [
        {
          id: plan,
          name: planConfig.label,
          price: planConfig.amount,
          quantity: 1,
        },
      ],
      customer_details: {
        first_name: profile?.name || user.email?.split('@')[0] || 'User',
        email: user.email || profile?.email,
      },
      // Expire the Snap token after 24 hours
      expiry: {
        unit: 'hours',
        duration: 24,
      },
    };

    const midtransRes = await fetch(snapUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authString}`,
      },
      body: JSON.stringify(midtransPayload),
    });

    const midtransData = await midtransRes.json();

    if (!midtransRes.ok) {
      console.error('Midtrans error:', midtransData);
      return jsonError(
        midtransData?.error_messages?.join(', ') || 'Failed to create payment',
        midtransRes.status
      );
    }

    // ── Save pending subscription to DB ──────────────────────────
    const expiresAt = new Date(Date.now() + planConfig.durationDays * 86400000).toISOString();

    await adminClient.from('subscriptions').insert({
      user_id: user.id,
      order_id: orderId,
      plan,
      amount: planConfig.amount,
      status: 'pending',
      expires_at: expiresAt,
    });

    // ── Return snap token to frontend ────────────────────────────
    return new Response(
      JSON.stringify({
        snap_token: midtransData.token,
        redirect_url: midtransData.redirect_url,
        order_id: orderId,
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('create-subscription error:', err);
    // M-6: Don't expose internal error details
    return jsonError('Gagal membuat pembayaran. Coba lagi nanti.', 500);
  }
});

function jsonError(message: string, status: number) {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    }
  );
}
