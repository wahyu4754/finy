import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_MODEL = 'gemini-3.1-flash-lite';

// ─── Security: limits ────────────────────────────────────────────────
const MAX_BODY_SIZE = 100 * 1024; // 100 KB (small text payload)
const MAX_NOTE_LENGTH = 500;

// ─── Security: sanitize user strings for prompt injection ────────────
function sanitizeForPrompt(s: string): string {
  return s.replace(/[\[\]<>{}]/g, '').replace(/\n/g, ' ').slice(0, 50);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    // ── Auth check (was MISSING before — anyone could call this) ────
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
      p_action: 'suggest-category',
      p_max: 60,
      p_window_minutes: 5,
    });
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Terlalu banyak permintaan' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // ── H-2: Input size validation ─────────────────────────────────
    const bodyText = await req.text();
    if (bodyText.length > MAX_BODY_SIZE) {
      return new Response(JSON.stringify({ error: 'Request terlalu besar' }), {
        status: 413,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    let parsedBody: any;
    try {
      parsedBody = JSON.parse(bodyText);
    } catch {
      return new Response(JSON.stringify({ error: 'Format request tidak valid' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const { note, userCategories } = parsedBody;

    if (!GEMINI_API_KEY) throw new Error('AI_NOT_CONFIGURED');

    // M-3: Validate inputs
    if (!note || typeof note !== 'string') {
      return new Response(JSON.stringify({ error: 'Note diperlukan' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
    if (!Array.isArray(userCategories) || userCategories.length === 0) {
      return new Response(JSON.stringify({ error: 'Kategori diperlukan' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // H-5: Sanitize user inputs for prompt
    const safeNote = note.slice(0, MAX_NOTE_LENGTH);
    const safeCategories = userCategories.map((c: string) => sanitizeForPrompt(c)).join(', ');

    const prompt = `Berdasarkan deskripsi transaksi berikut, suggest 1 kategori dari list.
Kategori: ${safeCategories}

WAJIB membalas HANYA dengan JSON murni tanpa markdown blocks:
{"category": "nama kategori", "confidence": 0.95}

Transaksi: ${safeNote}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'X-goog-api-key': GEMINI_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            thinkingConfig: { thinkingLevel: 'MINIMAL' },
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error(`[suggest-category] Gemini error ${response.status}:`, err);
      throw new Error('AI_SERVICE_ERROR');
    }

    const data = await response.json();
    if (!data.candidates?.length) throw new Error('AI_EMPTY_RESPONSE');

    let content = data.candidates[0].content.parts[0].text;
    content = content.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(content);

    return new Response(JSON.stringify(parsed), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (error: any) {
    console.error('[suggest-category] Error:', error);
    // M-6: Safe error messages
    const safeMessage = error.message === 'Unauthorized'
      ? 'Unauthorized'
      : 'Gagal menyarankan kategori. Coba lagi.';
    return new Response(JSON.stringify({ error: safeMessage }), {
      status: error.message === 'Unauthorized' ? 401 : 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
