import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';

// ─── Security: max sizes ─────────────────────────────────────────────
const MAX_BODY_SIZE = 10 * 1024 * 1024;  // 10 MB total
const MAX_IMAGE_SIZE = 5_000_000;         // ~3.7 MB raw base64

// ─── Security: sanitize user strings for prompt injection ────────────
function sanitizeForPrompt(s: string): string {
  return s.replace(/[\[\]<>{}]/g, '').replace(/\n/g, ' ').slice(0, 50);
}

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
      p_action: 'parse-receipt',
      p_max: 20,
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

    const { imageBase64, mimeType, userCategories } = parsedBody;

    if (!GEMINI_API_KEY) {
      await supabaseClient.rpc('refund_ai_credit');
      throw new Error('AI_NOT_CONFIGURED');
    }
    if (!imageBase64) {
      await supabaseClient.rpc('refund_ai_credit');
      return new Response(JSON.stringify({ error: 'Gambar diperlukan' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
    if (imageBase64.length > MAX_IMAGE_SIZE) {
      await supabaseClient.rpc('refund_ai_credit');
      return new Response(JSON.stringify({ error: 'Gambar terlalu besar (maks ~3.7 MB)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // H-5: Sanitize user categories for prompt
    const safeCategories = Array.isArray(userCategories)
      ? userCategories.map((c: string) => sanitizeForPrompt(c)).join(', ')
      : '';

    const systemPrompt = `Kamu adalah AI parse struk Indonesia. Analisis gambar struk yang diberikan dan ekstrak datanya dengan akurat.
Kategori user yang tersedia: ${safeCategories}.

WAJIB membalas HANYA dengan JSON murni tanpa markdown blocks (tanpa \`\`\`json), dengan format persis:
{
  "merchant": "Nama Toko",
  "total": 25000,
  "date": "YYYY-MM-DD",
  "items": [{"name": "Nama Barang", "price": 10000}],
  "suggested_category": "Pilih Salah Satu Dari List Kategori Diatas",
  "confidence": 0.95
}

Aturan:
- "total" dalam integer Rupiah (contoh "Rp 25.000" → 25000, "Rp 1.250.500" → 1250500)
- "date" format YYYY-MM-DD; kalau tidak ada di struk, pakai tanggal hari ini
- "suggested_category" HARUS persis sama dengan salah satu kategori di list user
- "confidence" 0-1 berdasarkan seberapa jelas struk terbaca`;

    const userPrompt = 'Parse struk ini dan kembalikan dalam format JSON yang diminta.';

    try {
      const parsed = await parseReceiptWithFallback(
        systemPrompt,
        userPrompt,
        imageBase64,
        mimeType || 'image/jpeg'
      );

      return new Response(JSON.stringify(parsed), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    } catch (aiError: any) {
      // Refund credit on AI failure
      await supabaseClient.rpc('refund_ai_credit');
      console.error('[parse-receipt] AI failed:', aiError);
      throw new Error('AI_SERVICE_ERROR');
    }
  } catch (error: any) {
    console.error('[parse-receipt] Error:', error);
    const isInsufficient = error.message === 'INSUFFICIENT_CREDITS';
    // M-6: Safe error messages
    const safeMessage = isInsufficient
      ? 'INSUFFICIENT_CREDITS'
      : error.message === 'Unauthorized'
        ? 'Unauthorized'
        : 'Gagal memproses struk. Coba lagi nanti.';
    return new Response(JSON.stringify({ error: safeMessage }), {
      status: isInsufficient ? 200 : 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});

async function parseReceiptWithFallback(
  systemPrompt: string,
  userPrompt: string,
  imageBase64: string,
  mediaType: string
): Promise<any> {
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash'];
  const errors: string[] = [];

  for (const model of models) {
    try {
      let content = await callGeminiVision(model, systemPrompt, userPrompt, imageBase64, mediaType);
      content = content.replace(/<(think|thought)>[\s\S]*?<\/\1>/gi, '');
      content = content.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(content);
      console.log(`[parse-receipt] OK via ${model}`);
      return parsed;
    } catch (e: any) {
      const msg = e?.message || String(e);
      console.warn(`[parse-receipt] ${model} failed: ${msg}`);
      errors.push(`${model}: ${msg}`);
    }
  }

  // M-6: Don't expose detailed AI error internals to client
  throw new Error('Semua AI provider gagal memparse struk');
}

async function callGeminiVision(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  imageBase64: string,
  mediaType: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-goog-api-key': GEMINI_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          { text: systemPrompt + '\n\n' + userPrompt },
          { inlineData: { mimeType: mediaType, data: imageBase64 } },
        ],
      }],
      generationConfig: { temperature: 0.1 },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`${model} returned ${response.status}: ${err}`);
  }

  const data = await response.json();
  if (!data.candidates?.length) throw new Error(`${model} returned empty candidates`);
  return data.candidates[0].content.parts[0].text as string;
}
