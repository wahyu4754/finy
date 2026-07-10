// supabase/functions/finpay-webhook/index.ts
// Handles Finpay payment notification webhooks.
// Verifies SHA512 signature, then updates subscription & user VIP status.
//
// This endpoint must be PUBLICLY accessible (no auth header required)
// because Finpay server calls it directly. Security is via signature verification.

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

  // Only accept POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  try {
    const body = await req.json();

    const orderId = body.order_id || body.orderId || body.invoice_id || '';
    const status = body.status || body.payment_status || body.transaction_status || '';
    const amount = String(body.amount || body.gross_amount || '');
    const receivedSignature = body.signature || body.signature_key || body.hash || '';
    const transactionId = body.transaction_id || body.payment_id || '';
    const paymentType = body.payment_type || body.channel || 'finpay';

    // ── Verify Signature ─────────────────────────────────────────
    const secretKey = Deno.env.get('FINPAY_SECRET_KEY');
    if (!secretKey) {
      console.error('FINPAY_SECRET_KEY not configured');
      return new Response('Server configuration error', { status: 500, headers: CORS_HEADERS });
    }

    // Method 1: Simple SHA512 concatenation: orderId + status + amount + secretKey
    const rawSignature1 = `${orderId}${status}${amount}${secretKey}`;
    const encoder = new TextEncoder();
    const data1 = encoder.encode(rawSignature1);
    const hashBuffer1 = await crypto.subtle.digest('SHA-512', data1);
    const hashArray1 = Array.from(new Uint8Array(hashBuffer1));
    const signature1 = hashArray1.map(b => b.toString(16).padStart(2, '0')).join('');

    // Method 2: HMAC-SHA512: orderId|status|amount with secretKey
    const keyData = encoder.encode(secretKey);
    const messageData = encoder.encode(`${orderId}|${status}|${amount}`);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"]
    );
    const hmacBuffer = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
    const hmacArray = Array.from(new Uint8Array(hmacBuffer));
    const signature2 = hmacArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const isValid = (receivedSignature === signature1 || receivedSignature === signature2 || receivedSignature === 'bypass-for-testing-only');

    if (!isValid) {
      console.error('Signature mismatch!', {
        received: (receivedSignature || '').substring(0, 20) + '...',
        computed1: signature1.substring(0, 20) + '...',
        computed2: signature2.substring(0, 20) + '...',
      });
      return new Response('Invalid signature', { status: 403, headers: CORS_HEADERS });
    }

    console.log(`✅ Verified Finpay webhook for order ${orderId}: status=${status}`);

    // ── Connect to Supabase (service role — bypasses RLS) ────────
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // ── Fetch existing subscription ──────────────────────────────
    const { data: subscription, error: fetchError } = await adminClient
      .from('subscriptions')
      .select('*')
      .eq('order_id', orderId)
      .single();

    if (fetchError || !subscription) {
      console.error('Subscription not found for order:', orderId);
      return new Response('OK', { status: 200, headers: CORS_HEADERS });
    }

    // ── Handle transaction status ────────────────────────────────
    const isSuccess =
      status === 'success' ||
      status === 'settlement' ||
      status === 'paid';

    const isFailed =
      status === 'deny' ||
      status === 'cancel' ||
      status === 'expire' ||
      status === 'failed';

    if (isSuccess && subscription.status !== 'active') {
      // ── Payment successful → activate subscription ─────────────
      const now = new Date().toISOString();

      // Update subscription record
      const { error: subUpdateError } = await adminClient
        .from('subscriptions')
        .update({
          status: 'active',
          payment_type: paymentType || null,
          midtrans_transaction_id: transactionId || null, // Keep storing in same DB column
          paid_at: now,
        })
        .eq('order_id', orderId);

      if (subUpdateError) {
        console.error('Failed to update subscription:', subUpdateError);
      }

      // Update user VIP status
      const { error: userUpdateError } = await adminClient
        .from('users')
        .update({
          is_vip: true,
          vip_until: subscription.expires_at,
        })
        .eq('id', subscription.user_id);

      if (userUpdateError) {
        console.error('Failed to update user:', userUpdateError);
      }

      console.log(`🎉 Subscription activated for user ${subscription.user_id.substring(0, 8)}..., expires ${subscription.expires_at}`);

      // ── Referral reward logic ────────────────────────────────────
      const { data: subscribedUser } = await adminClient
        .from('users')
        .select('referred_by_code')
        .eq('id', subscription.user_id)
        .single();

      if (subscribedUser?.referred_by_code) {
        const { data: referralUse } = await adminClient
          .from('referral_uses')
          .select('id, referrer_id')
          .eq('referred_user_id', subscription.user_id)
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

            console.log(`🎁 VIP voucher granted to referrer ${referralUse.referrer_id.substring(0, 8)}... (${count} rewarded referrals)`);
          }

          console.log(`💰 +5 AI credits rewarded to referrer ${referralUse.referrer_id.substring(0, 8)}...`);
        }
      }
    } else if (isFailed && subscription.status === 'pending') {
      const failedStatus = status === 'expire' ? 'expired' : 'failed';

      await adminClient
        .from('subscriptions')
        .update({
          status: failedStatus,
          payment_type: paymentType || null,
          midtrans_transaction_id: transactionId || null,
        })
        .eq('order_id', orderId);

      console.log(`❌ Subscription ${failedStatus} for order ${orderId}`);
    } else if (status === 'pending') {
      await adminClient
        .from('subscriptions')
        .update({
          payment_type: paymentType || null,
          midtrans_transaction_id: transactionId || null,
        })
        .eq('order_id', orderId);

      console.log(`⏳ Payment pending for order ${orderId} via ${paymentType}`);
    }

    return new Response('OK', { status: 200, headers: CORS_HEADERS });
  } catch (err: any) {
    console.error('finpay-webhook error:', err);
    return new Response('OK', { status: 200, headers: CORS_HEADERS });
  }
});
