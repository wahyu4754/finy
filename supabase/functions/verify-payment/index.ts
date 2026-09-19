// supabase/functions/verify-payment/index.ts
// Verifies transaction status directly with Midtrans Core API (GET /v2/{order_id}/status).
// Immediately activates VIP status without waiting for asynchronous webhooks.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // 1. Verify user JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = await req.json();
    const orderId = body.order_id || body.orderId;
    if (!orderId) {
      return jsonResponse({ error: 'Missing order_id' }, 400);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Fetch subscription belonging to this user
    const { data: subscription, error: subError } = await adminClient
      .from('subscriptions')
      .select('*')
      .eq('order_id', orderId)
      .eq('user_id', user.id)
      .single();

    if (subError || !subscription) {
      return jsonResponse({ error: 'Subscription order not found' }, 404);
    }

    // If already active, return immediately
    if (subscription.status === 'active') {
      return jsonResponse({ success: true, is_vip: true, status: 'active' }, 200);
    }

    // 3. Query Midtrans Core API for order status
    const serverKey = Deno.env.get('MIDTRANS_SERVER_KEY');
    if (!serverKey) {
      return jsonResponse({ error: 'MIDTRANS_SERVER_KEY not configured' }, 500);
    }

    const isProduction =
      Deno.env.get('MIDTRANS_IS_PRODUCTION') === 'true' ||
      Deno.env.get('MIDTRANS_PRODUCTION') === 'true' ||
      Deno.env.get('MIDTRANS_PRODUCTION') === '1';

    const statusApiUrl = isProduction
      ? `https://api.midtrans.com/v2/${orderId}/status`
      : `https://api.sandbox.midtrans.com/v2/${orderId}/status`;

    const midtransRes = await fetch(statusApiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Basic ${btoa(serverKey + ':')}`,
      },
    });

    const midtransData = await midtransRes.json();
    console.log(`🔍 Midtrans status check for ${orderId}:`, {
      statusCode: midtransData.status_code,
      transactionStatus: midtransData.transaction_status,
      fraudStatus: midtransData.fraud_status,
    });

    const transactionStatus = String(midtransData.transaction_status || '');
    const fraudStatus = String(midtransData.fraud_status || '');
    const transactionId = String(midtransData.transaction_id || '');
    const paymentType = String(midtransData.payment_type || '');

    const isSuccess =
      transactionStatus === 'settlement' ||
      (transactionStatus === 'capture' && fraudStatus === 'accept');

    if (isSuccess) {
      const now = new Date().toISOString();

      // Update subscription
      await adminClient
        .from('subscriptions')
        .update({
          status: 'active',
          payment_type: paymentType || null,
          midtrans_transaction_id: transactionId || null,
          paid_at: now,
        })
        .eq('order_id', orderId);

      // Activate VIP on users table
      await adminClient
        .from('users')
        .update({
          is_vip: true,
          vip_until: subscription.expires_at,
        })
        .eq('id', user.id);

      // Handle referral rewards
      const { data: profile } = await adminClient
        .from('users')
        .select('referred_by_code')
        .eq('id', user.id)
        .single();

      if (profile?.referred_by_code) {
        const { data: referralUse } = await adminClient
          .from('referral_uses')
          .select('id, referrer_id')
          .eq('referred_user_id', user.id)
          .eq('rewarded', false)
          .maybeSingle();

        if (referralUse) {
          await adminClient
            .from('referral_uses')
            .update({ rewarded: true })
            .eq('id', referralUse.id);

          await adminClient.rpc('increment_ai_credits', {
            p_user_id: referralUse.referrer_id,
            p_amount: 5,
          });

          const { count } = await adminClient
            .from('referral_uses')
            .select('id', { count: 'exact', head: true })
            .eq('referrer_id', referralUse.referrer_id)
            .eq('rewarded', true);

          if (count && count % 3 === 0) {
            await adminClient
              .from('users')
              .update({ has_vip_voucher: true })
              .eq('id', referralUse.referrer_id);
          }
        }
      }

      console.log(`🎉 Direct verification activated VIP for user ${user.id}`);
      return jsonResponse({
        success: true,
        is_vip: true,
        status: 'active',
        message: 'Subscription successfully activated',
      }, 200);
    }

    return jsonResponse({
      success: false,
      is_vip: false,
      status: transactionStatus || 'pending',
      message: `Transaction status is ${transactionStatus || 'pending'}`,
    }, 200);
  } catch (err: any) {
    console.error('verify-payment error:', err);
    return jsonResponse({ error: err?.message || 'Verification failed' }, 500);
  }
});

function jsonResponse(data: any, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
