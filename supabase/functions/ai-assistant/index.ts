import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_MODEL = 'gemini-2.5-flash';

// ─── Security: max body sizes ────────────────────────────────────────
const MAX_BODY_SIZE = 10 * 1024 * 1024;  // 10 MB
const MAX_IMAGE_SIZE = 5_000_000;         // ~3.7 MB raw
const MAX_MESSAGES = 50;
const MAX_IMAGES = 5;
const MAX_MESSAGE_LENGTH = 10_000;

// ─── Security: sanitize user strings for prompt injection ────────────
function sanitizeForPrompt(s: string): string {
  return s.replace(/[\[\]<>{}]/g, '').replace(/\n/g, ' ').slice(0, 50);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
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
      p_action: 'ai-assistant',
      p_max: 30,
      p_window_minutes: 5,
    });
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Terlalu banyak permintaan. Coba lagi nanti.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // ── H-1: Atomic credit consumption (pre-deduct) ────────────────
    const { data: creditOk } = await supabaseClient.rpc('consume_ai_credit');
    if (!creditOk) throw new Error('INSUFFICIENT_CREDITS');

    // ── H-2: Input size validation ─────────────────────────────────
    const bodyText = await req.text();
    if (bodyText.length > MAX_BODY_SIZE) {
      // Refund credit since we didn't call AI
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

    const { messages, images, context } = parsedBody;

    if (!GEMINI_API_KEY) {
      await supabaseClient.rpc('refund_ai_credit');
      throw new Error('AI_NOT_CONFIGURED');
    }

    // Validate input shapes
    if (messages && (!Array.isArray(messages) || messages.length > MAX_MESSAGES)) {
      await supabaseClient.rpc('refund_ai_credit');
      return new Response(JSON.stringify({ error: 'Terlalu banyak pesan' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    if (images && (!Array.isArray(images) || images.length > MAX_IMAGES)) {
      await supabaseClient.rpc('refund_ai_credit');
      return new Response(JSON.stringify({ error: 'Terlalu banyak gambar (maks 5)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Check individual image sizes
    if (images) {
      for (const img of images) {
        if (img.base64 && img.base64.length > MAX_IMAGE_SIZE) {
          await supabaseClient.rpc('refund_ai_credit');
          return new Response(JSON.stringify({ error: 'Gambar terlalu besar (maks ~3.7 MB)' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          });
        }
      }
    }

    // ── Build system prompt ──────────────────────────────────────────
    const categories = context?.categories || [];
    const wallets = context?.wallets || [];
    const defaultWalletId = context?.defaultWalletId || '';
    const todayStr = new Date().toISOString().slice(0, 10);

    // H-5: Sanitize user-provided strings to prevent prompt injection
    const categoryList = categories.map((c: any) =>
      `${sanitizeForPrompt(c.name)} [${c.type === 'expense' ? 'expense' : 'income'}]`
    ).join(', ');
    const walletList = wallets.map((w: any) =>
      `${sanitizeForPrompt(w.name)} (${w.id})`
    ).join(', ');

    const systemPrompt = `Nama kamu adalah Finy. Kamu adalah asisten keuangan pribadi AI yang sangat cerdas di aplikasi Finy.
Gaya bahasamu santai dan asik, seperti teman dekat. GUNAKAN HANYA emoji wajah (😄🤔😅😎). Jawab SINGKAT dan padat.

KEMAMPUAN UTAMA:
Kamu bisa mencatat pengeluaran dan pemasukan dari teks percakapan DAN dari gambar struk/nota.
Saat user mengirim gambar struk, analisis gambar tersebut dan ekstrak data transaksi.
Saat user menyebut pengeluaran/pemasukan dalam teks biasa, ekstrak juga sebagai transaksi.

KATEGORI YANG TERSEDIA (user): ${categoryList}
DOMPET TERSEDIA: ${walletList}
DOMPET DEFAULT: ${defaultWalletId}
TANGGAL HARI INI: ${todayStr}

ATURAN WAJIB:
1. SELALU balas dalam format JSON MURNI (tanpa markdown code block, tanpa \`\`\`json).
2. Format balasan HARUS persis:
{
  "reply": "Pesanmu ke user",
  "transactions_to_add": [
    {
      "amount": 25000,
      "category": "Makan",
      "type": "expense",
      "note": "Kopi Starbucks",
      "date": "${todayStr}",
      "wallet_id": "${defaultWalletId}"
    }
  ]
}
3. Jika TIDAK ada transaksi yang perlu dicatat (misal user cuma ngobrol), isi "transactions_to_add" dengan array kosong [].
4. "amount" HARUS integer Rupiah (Rp 25.000 → 25000).
5. "category" HARUS persis sama dengan salah satu nama kategori di list di atas.
6. "type" HARUS "expense" atau "income", sesuai dengan tipe kategorinya.
7. "date" format YYYY-MM-DD. Jika tidak disebutkan, pakai tanggal hari ini.
8. "wallet_id" pakai dompet default kecuali user menyebutkan dompet tertentu.
9. Jika user bertanya di luar topik keuangan, TOLAK SOPAN.
10. Dari gambar struk: ekstrak total sebagai 1 transaksi, beri note nama merchant/toko.`;

    // ── Build Gemini contents array ──────────────────────────────────
    const contents: any[] = [];

    for (const msg of (messages || [])) {
      if (msg.role === 'system') continue;
      const role = msg.role === 'assistant' ? 'model' : 'user';
      // M-3: Truncate individual messages
      const text = typeof msg.content === 'string' ? msg.content.slice(0, MAX_MESSAGE_LENGTH) : '';
      contents.push({
        role,
        parts: [{ text }],
      });
    }

    // If there are images, attach them to the LAST user message
    if (images && images.length > 0) {
      const imageParts = images.map((img: any) => ({
        inlineData: {
          mimeType: img.mimeType || 'image/jpeg',
          data: img.base64,
        },
      }));

      const lastUserIdx = contents.length - 1;
      if (lastUserIdx >= 0 && contents[lastUserIdx].role === 'user') {
        contents[lastUserIdx].parts.push(...imageParts);
      } else {
        contents.push({
          role: 'user',
          parts: [
            { text: 'Tolong parse struk-struk ini dan catat transaksinya.' },
            ...imageParts,
          ],
        });
      }
    }

    // ── Call Gemini ──────────────────────────────────────────────────
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
          temperature: 0.3,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`Gemini API error ${response.status}:`, err);
      // Refund credit on AI failure
      await supabaseClient.rpc('refund_ai_credit');
      // M-6: Don't expose internal API error details to client
      throw new Error('AI_SERVICE_ERROR');
    }

    const data = await response.json();
    if (!data.candidates?.length) {
      await supabaseClient.rpc('refund_ai_credit');
      throw new Error('AI_EMPTY_RESPONSE');
    }

    let rawText = data.candidates[0].content.parts[0].text as string;

    // Clean up thinking tags and markdown wrappers
    rawText = rawText.replace(/<(think|thought)>[\s\S]*?<\/\1>/gi, '');
    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    // Parse JSON response
    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = { reply: rawText, transactions_to_add: [] };
    }

    // Credit was already deducted atomically — no need for a separate update

    return new Response(JSON.stringify(parsed), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (error: any) {
    console.error('[ai-assistant] Error:', error);
    const isInsufficient = error.message === 'INSUFFICIENT_CREDITS';
    // M-6: Return safe error messages, no internal details
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
