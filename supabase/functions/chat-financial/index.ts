import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_MODEL = 'gemini-2.5-flash';

// ─── Security: limits ────────────────────────────────────────────────
const MAX_BODY_SIZE = 2 * 1024 * 1024;  // 2 MB (text only, no images)
const MAX_MESSAGES = 50;
const MAX_MESSAGE_LENGTH = 10_000;

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

    // ── H-3: Rate limiting ─────────────────────────────────────────
    const { data: allowed } = await supabaseClient.rpc('check_rate_limit', {
      p_action: 'chat-financial',
      p_max: 30,
      p_window_minutes: 5,
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

    const { messages, contextStats } = parsedBody;

    if (!GEMINI_API_KEY) {
      await supabaseClient.rpc('refund_ai_credit');
      throw new Error('AI_NOT_CONFIGURED');
    }

    // M-3: Validate messages array
    if (!Array.isArray(messages) || messages.length > MAX_MESSAGES) {
      await supabaseClient.rpc('refund_ai_credit');
      return new Response(JSON.stringify({ error: 'Format pesan tidak valid' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const systemPrompt = `Nama kamu adalah Finy. Kamu adalah asisten keuangan pribadi AI di aplikasi bernama Finy.
Gaya bahasamu sangat santai, asik, ngalir, seperti teman dekat.
GUNAKAN HANYA emoji wajah (seperti 😄, 🤔, 😅, 😎), JANGAN gunakan emoji benda, bangunan, atau lainnya. Jangan terlalu berlebihan pakai emoji.
JAWAB DENGAN SINGKAT dan padat untuk menghemat token.
PENTING: JIKA user bertanya sesuatu di luar topik keuangan pribadi, budgeting, atau aplikasi Finy (misalnya: politik, sejarah, coding umum, resep masakan), KAMU HARUS MENOLAK DENGAN SOPAN dan ingatkan bahwa kamu hanya fokus membantu masalah keuangan.

Berikut adalah kondisi keuangan user bulan ini sebagai konteks (TIDAK PERLU disebutkan kecuali user bertanya):
- Total Saldo Dompet Saat Ini: Rp ${contextStats?.totalBalance || 0}
- Pengeluaran Bulan Ini: Rp ${contextStats?.totalExpense || 0}
- Pemasukan Bulan Ini: Rp ${contextStats?.totalIncome || 0}
- Sisa Budget Bulan Ini: Rp ${(contextStats?.budget || 0) - (contextStats?.totalExpense || 0)}
`;

    const conversationMessages = messages
      .filter((m: any) => m.role === 'user' || m.role === 'assistant')
      .map((m: any) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        // M-3: Truncate individual messages
        parts: [{ text: typeof m.content === 'string' ? m.content.slice(0, MAX_MESSAGE_LENGTH) : '' }],
      }));

    try {
      const content = await callGemini(systemPrompt, conversationMessages);

      return new Response(JSON.stringify({ content }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    } catch (aiError: any) {
      // Refund credit on AI failure
      await supabaseClient.rpc('refund_ai_credit');
      console.error('[chat-financial] AI error:', aiError);
      throw new Error('AI_SERVICE_ERROR');
    }
  } catch (error: any) {
    console.error('[chat-financial] Error:', error);
    const isInsufficient = error.message === 'INSUFFICIENT_CREDITS';
    // M-6: Safe error messages
    const safeMessage = isInsufficient
      ? 'INSUFFICIENT_CREDITS'
      : error.message === 'Unauthorized'
        ? 'Unauthorized'
        : 'Terjadi kesalahan pada layanan AI. Coba lagi nanti.';
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
      generationConfig: {
        temperature: 0.7,
        thinkingConfig: { thinkingBudget: 0 },
      },
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
