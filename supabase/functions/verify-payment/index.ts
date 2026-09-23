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

    // 2. Fetch subscription belonging to this user (M-13: only pending can be activated)
    const { data: subscription, error: subError } = await adminClient
      .from('subscriptions')
      .select('*')
      .eq('order_id', orderId)
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .single();

    if (subError || !subscription) {
      // Check if already active (idempotent re-verify)
      const { data: activeSub } = await adminClient
        .from('subscriptions')
        .select('*')
        .eq('order_id', orderId)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (activeSub) {
        return jsonResponse({ success: true, is_vip: true, status: 'active' }, 200);
      }
      return jsonResponse({ error: 'Subscription order not found', success: false, is_vip: false }, 404);
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
      // M-13: Validate gross_amount matches subscription
      const expectedAmount = String(subscription.amount || '');
      const receivedAmount = String(midtransData.gross_amount || '').replace(/\..*/, '');
      if (expectedAmount && receivedAmount && expectedAmount !== receivedAmount) {
        console.error(`Amount mismatch: expected ${expectedAmount}, got ${receivedAmount}`);
        return jsonResponse({ error: 'Amount mismatch', success: false, is_vip: false }, 403);
      }

      // M-10: Use activate_subscription RPC for atomic activation + VIP extension
      const durationDays = subscription.plan === 'annual' ? 365 : 30;
      const { data: activated, error: activateError } = await adminClient.rpc('activate_subscription', {
        p_order_id: orderId,
        p_duration_days: durationDays,
      });

      if (activateError) {
        console.error('activate_subscription RPC failed:', activateError);
        return jsonResponse({ error: 'Failed to activate subscription', success: false, is_vip: false }, 500);
      }

      // H-03: Use atomic referral reward RPC
      const { data: profile } = await adminClient
        .from('users')
        .select('referred_by_code')
        .eq('id', user.id)
        .single();

      if (profile?.referred_by_code) {
        await adminClient.rpc('grant_referral_reward', {
          p_referred_user_id: user.id,
        });
      }

      // M-12: Confirm VIP was actually set
      const { data: updatedUser } = await adminClient
        .from('users')
        .select('is_vip')
        .eq('id', user.id)
        .single();

      const isVip = updatedUser?.is_vip === true;
      console.log(`🎉 Direct verification for user ${user.id}: activated=${activated}, isVip=${isVip}`);
      return jsonResponse({
        success: isVip,
        is_vip: isVip,
        status: 'active',
        message: isVip ? 'Subscription successfully activated' : 'Subscription activated but VIP update pending',
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
