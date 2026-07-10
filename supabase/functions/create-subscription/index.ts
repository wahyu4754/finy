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

    // ── Create Finpay payment link ───────────────────────────────
    const finpayMerchantId = Deno.env.get('FINPAY_MERCHANT_ID');
    const finpaySecretKey = Deno.env.get('FINPAY_SECRET_KEY');
    const finpayBaseUrl = Deno.env.get('FINPAY_BASE_URL') || 'https://sandbox.finpay.id/api/v1/';

    if (!finpayMerchantId || !finpaySecretKey) {
      return jsonError('FINPAY_SECRET_KEY or FINPAY_MERCHANT_ID is not configured', 500);
    }

    const requestUrl = `${finpayBaseUrl.replace(/\/$/, '')}/payment`;
    const authString = btoa(`${finpayMerchantId}:${finpaySecretKey}`);

    const finpayPayload = {
      order: {
        order_id: orderId,
        amount: planConfig.amount,
        description: planConfig.label,
      },
      customer: {
        name: profile?.name || user.email?.split('@')[0] || 'User',
        email: user.email || profile?.email || '',
      },
      url: {
        callback_url: 'https://hahjrdldqbxbzufzazbm.supabase.co/functions/v1/finpay-webhook',
        success_url: 'https://finy.wahyusatrio.com/home',
        fail_url: 'https://finy.wahyusatrio.com/upgrade',
      }
    };

    const finpayRes = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authString}`,
      },
      body: JSON.stringify(finpayPayload),
    });

    const finpayData = await finpayRes.json();

    if (!finpayRes.ok) {
      console.error('Finpay error:', finpayData);
      return jsonError(
        finpayData?.error_messages?.join(', ') || finpayData?.message || 'Failed to create payment',
        finpayRes.status
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

    // ── Return redirect url to frontend ──────────────────────────
    return new Response(
      JSON.stringify({
        snap_token: finpayData.token || finpayData.snap_token || 'finpay-token',
        redirect_url: finpayData.redirect_url,
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
