// supabase/functions/midtrans-webhook/index.ts
// Handles Midtrans payment notification webhooks.
// Verifies SHA512 signature, then updates subscription & user VIP status.
//
// This endpoint must be PUBLICLY accessible (no auth header required)
// because Midtrans server calls it directly. Security is via signature verification.

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

    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
      payment_type,
      transaction_id,
    } = body;

    // ── Verify Signature ─────────────────────────────────────────
    const serverKey = Deno.env.get('MIDTRANS_SERVER_KEY');
    if (!serverKey) {
      console.error('MIDTRANS_SERVER_KEY not configured');
      return new Response('Server configuration error', { status: 500, headers: CORS_HEADERS });
    }

    const rawSignature = `${order_id}${status_code}${gross_amount}${serverKey}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(rawSignature);
    const hashBuffer = await crypto.subtle.digest('SHA-512', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const computedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    if (computedSignature !== signature_key) {
      console.error('Signature mismatch!', {
        computed: computedSignature.substring(0, 20) + '...',
        received: (signature_key || '').substring(0, 20) + '...',
      });
      return new Response('Invalid signature', { status: 403, headers: CORS_HEADERS });
    }

    console.log(`✅ Verified webhook for order ${order_id}: status=${transaction_status}`);

    // ── Connect to Supabase (service role — bypasses RLS) ────────
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // ── Fetch existing subscription ──────────────────────────────
    const { data: subscription, error: fetchError } = await adminClient
      .from('subscriptions')
      .select('*')
      .eq('order_id', order_id)
      .single();

    if (fetchError || !subscription) {
      console.error('Subscription not found for order:', order_id);
      // Return 200 so Midtrans doesn't retry endlessly
      return new Response('OK', { status: 200, headers: CORS_HEADERS });
    }

    // ── Handle transaction status ────────────────────────────────
    const isSuccess =
      transaction_status === 'settlement' ||
      (transaction_status === 'capture' && fraud_status === 'accept');

    const isFailed =
      transaction_status === 'deny' ||
      transaction_status === 'cancel' ||
      transaction_status === 'expire';

    if (isSuccess && subscription.status !== 'active') {
      // ── Payment successful → activate subscription ─────────────
      const now = new Date().toISOString();

      // Update subscription record
      const { error: subUpdateError } = await adminClient
        .from('subscriptions')
        .update({
          status: 'active',
          payment_type: payment_type || null,
          midtrans_transaction_id: transaction_id || null,
          paid_at: now,
        })
        .eq('order_id', order_id);

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
      // Check if the newly subscribed user was referred by someone
      const { data: subscribedUser } = await adminClient
        .from('users')
        .select('referred_by_code')
        .eq('id', subscription.user_id)
        .single();

      if (subscribedUser?.referred_by_code) {
        // Find the referral_uses row that hasn't been rewarded yet
        const { data: referralUse } = await adminClient
          .from('referral_uses')
          .select('id, referrer_id')
          .eq('referred_user_id', subscription.user_id)
          .eq('rewarded', false)
          .maybeSingle();

        if (referralUse) {
          // Mark this referral use as rewarded
          await adminClient
            .from('referral_uses')
            .update({ rewarded: true })
            .eq('id', referralUse.id);

          // Give referrer +5 AI credits
          await adminClient.rpc('increment_ai_credits', {
            p_user_id: referralUse.referrer_id,
            p_amount: 5,
          });

          // Count how many rewarded referrals this referrer now has
          const { count } = await adminClient
            .from('referral_uses')
            .select('id', { count: 'exact', head: true })
            .eq('referrer_id', referralUse.referrer_id)
            .eq('rewarded', true);

          // Every 3 rewarded referrals grant a free VIP voucher
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
      // ── Payment failed/expired/cancelled ───────────────────────
      const failedStatus = transaction_status === 'expire' ? 'expired' : 'failed';

      await adminClient
        .from('subscriptions')
        .update({
          status: failedStatus,
          payment_type: payment_type || null,
          midtrans_transaction_id: transaction_id || null,
        })
        .eq('order_id', order_id);

      console.log(`❌ Subscription ${failedStatus} for order ${order_id}`);
    } else if (transaction_status === 'pending') {
      // ── Payment pending (e.g., waiting for VA transfer) ────────
      await adminClient
        .from('subscriptions')
        .update({
          payment_type: payment_type || null,
          midtrans_transaction_id: transaction_id || null,
        })
        .eq('order_id', order_id);

      console.log(`⏳ Payment pending for order ${order_id} via ${payment_type}`);
    }

    // Always return 200 to acknowledge receipt (Midtrans requirement)
    return new Response('OK', { status: 200, headers: CORS_HEADERS });
  } catch (err: any) {
    console.error('midtrans-webhook error:', err);
    // Return 200 even on error to prevent Midtrans retry flood
    return new Response('OK', { status: 200, headers: CORS_HEADERS });
  }
});
