import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_MODEL = 'gemini-2.5-flash';

// ─── Security: limits ────────────────────────────────────────────────
const MAX_BODY_SIZE = 1 * 1024 * 1024; // 1 MB (structured data only)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Unauthorized');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    // ── H-3: Rate limiting (stricter — expensive operation) ────────
    const { data: allowed } = await supabaseClient.rpc('check_rate_limit', {
      p_action: 'monthly-conclusion',
      p_max: 5,
      p_window_minutes: 10,
    });
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Terlalu banyak permintaan. Coba lagi nanti.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // ── H-1: Atomic credit consumption ─────────────────────────────
    const { data: creditOk } = await supabaseClient.rpc('consume_ai_credit');
    if (!creditOk) throw new Error('INSUFFICIENT_CREDITS');

    // ── H-2: Input size validation ─────────────────────────────────
    const bodyText = await req.text();
    if (bodyText.length > MAX_BODY_SIZE) {
      await supabaseClient.rpc('refund_ai_credit');
      return new Response(JSON.stringify({ error: 'Request terlalu besar' }), {
        status: 413,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    let parsedBody: any;
    try {
      parsedBody = JSON.parse(bodyText);
    } catch {
      await supabaseClient.rpc('refund_ai_credit');
      return new Response(JSON.stringify({ error: 'Format request tidak valid' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const { month, totalExpense, totalIncome, budget, categoryBreakdown, lastMonthExpense, topTransactions, totalBalance } = parsedBody;

    if (!GEMINI_API_KEY) {
      await supabaseClient.rpc('refund_ai_credit');
      throw new Error('AI_NOT_CONFIGURED');
    }

    // M-3: Basic validation
    if (!month || typeof month !== 'string') {
      await supabaseClient.rpc('refund_ai_credit');
      return new Response(JSON.stringify({ error: 'Parameter bulan diperlukan' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const systemPrompt = `Kamu financial advisor warm & supportive untuk user Indonesia.
Beri analisis actionable, tidak menggurui, tone friendly seperti teman dekat.
WAJIB membalas HANYA dengan JSON murni tanpa markdown blocks, dengan format:
{
  "summary": "2-3 kalimat ringkasan bulan ini",
  "insights": [
    {"title": "judul", "description": "deskripsi", "type": "warning|tip|praise"}
  ],
  "trend_note": "string"
}
Maksimal 3 insights yang ACTIONABLE.`;

    const userPrompt = `Data bulan ${month}:
- Total Saldo Dompet Saat Ini: Rp ${totalBalance || 0}
- Total expense: Rp ${totalExpense || 0}
- Total income: Rp ${totalIncome || 0}
- Budget: Rp ${budget || 0}
- Distribusi kategori: ${JSON.stringify(categoryBreakdown || [])}
- Bulan lalu: Rp ${lastMonthExpense || 0}
- Top 5 transaksi: ${JSON.stringify(topTransactions || [])}`;

    try {
      let content = await callGemini(systemPrompt, [{ role: 'user', parts: [{ text: userPrompt }] }]);
      content = content.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(content);

      return new Response(JSON.stringify(parsed), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    } catch (aiError: any) {
      await supabaseClient.rpc('refund_ai_credit');
      console.error('[monthly-conclusion] AI error:', aiError);
      throw new Error('AI_SERVICE_ERROR');
    }
  } catch (error: any) {
    console.error('[monthly-conclusion] Error:', error);
    const isInsufficient = error.message === 'INSUFFICIENT_CREDITS';
    // M-6: Safe error messages
    const safeMessage = isInsufficient
      ? 'INSUFFICIENT_CREDITS'
      : error.message === 'Unauthorized'
        ? 'Unauthorized'
        : 'Gagal membuat analisis. Coba lagi nanti.';
    return new Response(JSON.stringify({ error: safeMessage }), {
      status: isInsufficient ? 200 : 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});

async function callGemini(systemPrompt: string, contents: any[]): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-goog-api-key': GEMINI_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { temperature: 0.5 },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  if (!data.candidates?.length) throw new Error('Gemini returned empty response');
  return data.candidates[0].content.parts[0].text as string;
}
