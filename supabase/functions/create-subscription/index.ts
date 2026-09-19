// supabase/functions/create-subscription/index.ts
// Creates a Midtrans Snap transaction token for Finy Pro subscription payments (Web/PWA).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
    // ── 1. Auth: extract user from JWT ───────────────────────────
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

    // ── 2. Rate limiting (strict — prevents order creation spam) ─
    const { data: allowed } = await userClient.rpc('check_rate_limit', {
      p_action: 'create-subscription',
      p_max: 5,
      p_window_minutes: 10,
    });
    if (!allowed) {
      return jsonError('Terlalu banyak permintaan transaksi. Coba lagi nanti.', 429);
    }

    // ── 3. Parse and validate request body ───────────────────────
    const body = await req.json();
    const plan = body.plan as string;

    if (!plan || !PLANS[plan]) {
      return jsonError('Paket tidak valid. Pilih "monthly" atau "annual".', 400);
    }

    const planConfig = PLANS[plan];

    // ── 4. Fetch user profile ────────────────────────────────────
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile } = await adminClient
      .from('users')
      .select('name, email')
      .eq('id', user.id)
      .single();

    // ── 5. Generate unique merchant order ID ─────────────────────
    const orderId = `FINY-${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

    // ── 6. Prepare Midtrans Snap API call ────────────────────────
    const serverKey = Deno.env.get('MIDTRANS_SERVER_KEY');
    if (!serverKey) {
      console.error('MIDTRANS_SERVER_KEY is not configured in Edge Function secrets');
      return jsonError('Gerbang pembayaran belum dikonfigurasi di server (MIDTRANS_SERVER_KEY missing).', 500);
    }

    const isProduction =
      Deno.env.get('MIDTRANS_IS_PRODUCTION') === 'true' ||
      Deno.env.get('MIDTRANS_PRODUCTION') === 'true' ||
      Deno.env.get('MIDTRANS_PRODUCTION') === '1';
    const snapUrl = isProduction
      ? 'https://app.midtrans.com/snap/v1/transactions'
      : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

    const customerName = profile?.name || user.email?.split('@')[0] || 'User';
    const nameParts = customerName.trim().split(' ');
    const firstName = nameParts[0] || 'User';
    const lastName = nameParts.slice(1).join(' ') || '';
    const customerEmail = user.email || profile?.email || 'user@finy.app';

    const snapPayload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: planConfig.amount, // integer IDR for Snap
      },
      customer_details: {
        first_name: firstName,
        last_name: lastName,
        email: customerEmail,
      },
      item_details: [
        {
          id: plan,
          price: planConfig.amount,
          quantity: 1,
          name: planConfig.label,
        },
      ],
      credit_card: {
        secure: true,
      },
    };

    const authHeaderBasic = `Basic ${btoa(serverKey + ':')}`;

    const midtransRes = await fetch(snapUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': authHeaderBasic,
      },
      body: JSON.stringify(snapPayload),
    });

    const midtransData = await midtransRes.json();

    if (!midtransRes.ok || !midtransData.token) {
      console.error('Midtrans Snap error:', {
        status: midtransRes.status,
        data: midtransData,
      });
      const errorMsg =
        midtransData?.error_messages?.join(', ') ||
        midtransData?.message ||
        'Gagal membuat sesi pembayaran Midtrans.';
      return jsonError(errorMsg, midtransRes.status);
    }

    // ── 7. Record pending subscription in DB ─────────────────────
    const expiresAt = new Date(Date.now() + planConfig.durationDays * 86400000).toISOString();

    const { error: insertError } = await adminClient.from('subscriptions').insert({
      user_id: user.id,
      order_id: orderId,
      plan,
      amount: planConfig.amount,
      status: 'pending',
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error('Failed to insert subscription record:', insertError);
      // Still proceed with returning token, as orderId is valid and webhook can reconcile
    }

    // ── 8. Return Snap token and redirect URL to frontend ────────
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
    return jsonError('Gagal memproses sesi pembayaran. Coba lagi nanti.', 500);
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
