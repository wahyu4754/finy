// supabase/functions/midtrans-webhook/index.ts
// Handles Midtrans HTTP payment notifications (Snap / Core API).
// Verifies SHA-512 signature, then updates subscription, VIP status, and referral rewards.
//
// This endpoint must be publicly accessible (verify_jwt = false)
// because Midtrans server-to-server calls it directly.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  try {
    const body = await req.json();

    const orderId = String(body.order_id || '');
    const statusCode = String(body.status_code || '');
    const grossAmount = String(body.gross_amount || '');
    const receivedSignature = String(body.signature_key || '');
    const transactionStatus = String(body.transaction_status || '');
    const fraudStatus = String(body.fraud_status || '');
    const transactionId = String(body.transaction_id || '');
    const paymentType = String(body.payment_type || '');

    if (!orderId || !statusCode || !grossAmount || !receivedSignature) {
      console.error('Missing required Midtrans notification fields:', { orderId, statusCode, grossAmount });
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // ── 1. Verify Midtrans SHA-512 Signature ─────────────────────
    // Signature formula: SHA512(order_id + status_code + gross_amount + ServerKey)
    // Note: Use raw string gross_amount directly from provider payload
    const serverKey = Deno.env.get('MIDTRANS_SERVER_KEY');
    if (!serverKey) {
      console.error('MIDTRANS_SERVER_KEY is not configured in Edge Function secrets');
      return new Response('Server configuration error', { status: 500, headers: CORS_HEADERS });
    }

    const rawString = `${orderId}${statusCode}${grossAmount}${serverKey}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(rawString);
    const hashBuffer = await crypto.subtle.digest('SHA-512', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const calculatedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    if (receivedSignature.toLowerCase() !== calculatedSignature.toLowerCase()) {
      console.error('Midtrans signature verification failed!', {
        orderId,
        received: receivedSignature.slice(0, 16) + '...',
        calculated: calculatedSignature.slice(0, 16) + '...',
      });
      return new Response('Invalid signature', { status: 403, headers: CORS_HEADERS });
    }

    console.log(`✅ Midtrans notification verified for order: ${orderId}, status: ${transactionStatus}, fraud: ${fraudStatus}`);

    // ── 2. Connect to Supabase (Admin client bypasses RLS) ───────
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // ── 3. Fetch existing subscription record ────────────────────
    const { data: subscription, error: fetchError } = await adminClient
      .from('subscriptions')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();

    if (fetchError || !subscription) {
      console.warn(`Subscription record not found for order ${orderId} (might belong to another system or test)`);
      // Return 200 OK so Midtrans stops retrying notifications for unknown orders
      return new Response(JSON.stringify({ status: 'ignored', message: 'Order not found' }), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // ── 4. Map Midtrans Transaction Status ────────────────────────
    const isSuccess =
      transactionStatus === 'settlement' ||
      (transactionStatus === 'capture' && fraudStatus === 'accept');

    const isPending = transactionStatus === 'pending';

    const isFailed =
      transactionStatus === 'deny' ||
      transactionStatus === 'cancel' ||
      transactionStatus === 'expire' ||
      transactionStatus === 'failure';

    // ── 5. Process States Idempotently ───────────────────────────
    if (isSuccess && subscription.status !== 'active') {
      // M-10: Use activate_subscription RPC for atomic activation + VIP extension
      const durationDays = subscription.plan === 'annual' ? 365 : 30;
      const { error: activateError } = await adminClient.rpc('activate_subscription', {
        p_order_id: orderId,
        p_duration_days: durationDays,
      });

      if (activateError) {
        console.error('activate_subscription RPC failed:', activateError);
      } else {
        console.log(`🎉 VIP activated for user ${subscription.user_id.slice(0, 8)}...`);
      }

      // H-03: Use atomic referral reward RPC
      const { data: subscribedUser } = await adminClient
        .from('users')
        .select('referred_by_code')
        .eq('id', subscription.user_id)
        .single();

      if (subscribedUser?.referred_by_code) {
        const { data: referralResult } = await adminClient.rpc('grant_referral_reward', {
          p_referred_user_id: subscription.user_id,
        });
        if (referralResult?.[0]?.credits_awarded) {
          console.log(`💰 +${referralResult[0].credits_awarded} AI credits rewarded to referrer`);
        }
      }
    } else if (isFailed && subscription.status === 'pending') {
      const finalStatus = transactionStatus === 'expire' ? 'expired' : 'failed';

      await adminClient
        .from('subscriptions')
        .update({
          status: finalStatus,
          payment_type: paymentType || null,
          midtrans_transaction_id: transactionId || null,
        })
        .eq('order_id', orderId);

      console.log(`❌ Subscription status updated to ${finalStatus} for order ${orderId}`);
    } else if (isPending) {
      await adminClient
        .from('subscriptions')
        .update({
          payment_type: paymentType || null,
          midtrans_transaction_id: transactionId || null,
        })
        .eq('order_id', orderId);

      console.log(`⏳ Payment pending for order ${orderId} via ${paymentType}`);
    }

    // Always acknowledge Midtrans webhook with 200 OK
    return new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('midtrans-webhook error:', err);
    // H-04: Return 500 so Midtrans retries with backoff.
    // Only return 200 for signature-valid-but-unknown-order and already-processed (above).
    return new Response(JSON.stringify({ error: err?.message || 'Internal error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
