import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_MODEL = 'gemini-3.1-flash-lite';

// The monthly analysis is a free feature now, so the only thing standing between
// an anonymous caller and a Gemini bill is this: one analysis per user per closed
// month, cached in ai_conclusions. Everything that used to guard the credit
// balance (consume_ai_credit / refund_ai_credit_for and the service-role client
// they needed) is gone with it.

// Preflight must echo the request headers the browser sends, or the real POST is never
// made and the page only sees an opaque network error. Same shape as delete-account,
// verify-payment and ai-assistant.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ─── Security: limits ────────────────────────────────────────────────
const MAX_BODY_SIZE = 1 * 1024 * 1024; // 1 MB (structured data only)
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const MAX_CATEGORIES = 30;
const MAX_TOP_TRANSACTIONS = 5;
const MAX_INSIGHTS = 3;

// Codes the client knows how to translate; anything else is collapsed to ANALYSIS_FAILED
// so an internal message never reaches the user.
const PASSTHROUGH_CODES = new Set([
  'AI_NOT_CONFIGURED',
  'AI_SERVICE_ERROR',
  'AI_EMPTY_RESPONSE',
  'AI_INVALID_RESPONSE',
  'MONTH_NOT_CLOSED',
  'UNAUTHORIZED',
]);

/**
 * A month may only be analysed once it has ended — the point of the feature is a
 * closed-book summary, and analysing the running month would produce a different
 * answer every time the user records another transaction.
 *
 * Read in WIB rather than from the container clock, which is UTC: for an Indonesian
 * user the month turns over 7 hours earlier locally than it does here, and the
 * client gates on its own local date. Disagreeing with the browser at that boundary
 * would show a button the server then refuses.
 */
function isMonthClosed(month: string, now: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);

  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  const mon = parts.find((p) => p.type === 'month')?.value ?? '';
  if (!year || !mon) return false;

  return month < `${year}-${mon}`;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function toNumber(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : 0;
}

function toText(value: unknown, max: number, fallback: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text.slice(0, max) : fallback;
}

/**
 * Coerces the client payload into the exact shape the prompt is built from.
 * Unbounded arrays and free-text fields would otherwise go straight into the
 * prompt, so both are capped here rather than trusted.
 */
function normalizeStats(raw: any) {
  const categoryBreakdown = Array.isArray(raw?.categoryBreakdown)
    ? raw.categoryBreakdown.slice(0, MAX_CATEGORIES).map((c: any) => ({
        category: toText(c?.category, 60, 'Lainnya'),
        amount: toNumber(c?.amount),
        percentage: toNumber(c?.percentage),
      }))
    : [];

  const topTransactions = Array.isArray(raw?.topTransactions)
    ? raw.topTransactions.slice(0, MAX_TOP_TRANSACTIONS).map((t: any) => ({
        note: toText(t?.note, 80, 'Transaksi'),
        category: toText(t?.category, 60, 'Lainnya'),
        amount: toNumber(t?.amount),
        date: toText(t?.date, 10, ''),
      }))
    : [];

  return {
    totalBalance: toNumber(raw?.totalBalance),
    totalExpense: toNumber(raw?.totalExpense),
    totalIncome: toNumber(raw?.totalIncome),
    budget: toNumber(raw?.budget),
    lastMonthExpense: toNumber(raw?.lastMonthExpense),
    transactionCount: toNumber(raw?.transactionCount),
    categoryBreakdown,
    topTransactions,
  };
}

type NormalizedStats = ReturnType<typeof normalizeStats>;

const systemPrompt = `Kamu financial advisor warm & supportive untuk user Indonesia.
Beri analisis actionable, tidak menggurui, tone friendly seperti teman dekat.
Gunakan HANYA angka yang ada di data. Jangan pernah mengarang angka, persentase, atau transaksi yang tidak tercantum.
Jika data terlalu sedikit untuk disimpulkan, katakan apa adanya dan beri satu saran pencatatan.
WAJIB membalas HANYA dengan JSON murni tanpa markdown blocks, dengan format:
{
  "summary": "2-3 kalimat ringkasan bulan ini",
  "insights": [
    {"title": "judul", "description": "deskripsi", "type": "warning|tip|praise"}
  ]
}
Maksimal 3 insights yang ACTIONABLE.`;

function buildUserPrompt(month: string, stats: NormalizedStats): string {
  return `Data bulan ${month} (${stats.transactionCount} transaksi tercatat):
- Total Saldo Dompet Saat Ini: Rp ${stats.totalBalance}
- Total expense: Rp ${stats.totalExpense}
- Total income: Rp ${stats.totalIncome}
- Budget: Rp ${stats.budget}
- Distribusi kategori: ${JSON.stringify(stats.categoryBreakdown)}
- Total expense bulan lalu: Rp ${stats.lastMonthExpense}
- Top 5 transaksi: ${JSON.stringify(stats.topTransactions)}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('UNAUTHORIZED');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('UNAUTHORIZED');

    // ── H-2: Input size validation ────────────────────────────────
    const bodyText = await req.text();
    if (bodyText.length > MAX_BODY_SIZE) return jsonResponse({ error: 'PAYLOAD_TOO_LARGE' }, 413);

    let parsedBody: any;
    try {
      parsedBody = JSON.parse(bodyText);
    } catch {
      return jsonResponse({ error: 'INVALID_BODY' }, 400);
    }

    const month = parsedBody?.month;
    if (typeof month !== 'string' || !MONTH_PATTERN.test(month)) {
      return jsonResponse({ error: 'INVALID_MONTH' }, 400);
    }

    if (!isMonthClosed(month)) return jsonResponse({ error: 'MONTH_NOT_CLOSED' }, 403);

    // C-11: the client nests its figures under `stats`; accept top-level too so the
    // contract can't silently drift back into analysing all zeros.
    const stats = normalizeStats(parsedBody?.stats ?? parsedBody);

    // The one-per-month allowance is enforced by this read, not by a counter:
    // ai_conclusions is unique per (user_id, month) and is only written after a
    // successful Gemini round-trip. A failed attempt stores nothing, so the user
    // can retry as often as they need — which is the behaviour they expect from a
    // free feature. `refresh` is deliberately not honoured: regenerating a stored
    // month would make the free allowance unlimited.
    const { data: cached, error: cacheError } = await supabaseClient
      .from('ai_conclusions')
      .select('id, user_id, month, summary, insights, generated_at')
      .eq('user_id', user.id)
      .eq('month', month)
      .maybeSingle();

    if (cacheError) {
      console.error('[monthly-conclusion] cache read failed:', cacheError.message);
    } else if (cached?.summary) {
      return jsonResponse({ ...cached, cached: true });
    }

    // Nothing to analyse: refuse rather than pay Gemini to invent a month from zeros.
    if (stats.transactionCount === 0) return jsonResponse({ error: 'NO_DATA' }, 422);

    if (!GEMINI_API_KEY) throw new Error('AI_NOT_CONFIGURED');

    // ── H-3: Rate limiting (stricter — expensive operation) ────────
    const { data: allowed } = await supabaseClient.rpc('check_rate_limit', {
      p_action: 'monthly-conclusion',
      p_max: 5,
      p_window_minutes: 10,
    });
    if (!allowed) return jsonResponse({ error: 'RATE_LIMITED' }, 429);

    const raw = await callGemini(systemPrompt, [
      { role: 'user', parts: [{ text: buildUserPrompt(month, stats) }] },
    ]);
    const parsed = extractJson(raw);

    const summary = toText(parsed?.summary, 2000, '');
    const insights = (Array.isArray(parsed?.insights) ? parsed.insights : [])
      .filter((i: any) => toText(i?.title, 120, '') && toText(i?.description, 1000, ''))
      .slice(0, MAX_INSIGHTS)
      .map((i: any) => ({
        title: toText(i.title, 120, 'Catatan'),
        description: toText(i.description, 1000, ''),
        type: ['warning', 'tip', 'praise'].includes(i?.type) ? i.type : 'tip',
      }));

    if (!summary || insights.length === 0) throw new Error('AI_INVALID_RESPONSE');

    // Storing the result is what makes this a one-per-month feature, so a failed
    // write is logged rather than thrown: the analysis was already produced and
    // the user should see it. The next visit simply regenerates.
    const { data: saved, error: upsertError } = await supabaseClient
      .from('ai_conclusions')
      .upsert({ user_id: user.id, month, summary, insights }, { onConflict: 'user_id,month' })
      .select('id, generated_at')
      .maybeSingle();

    if (upsertError) console.error('[monthly-conclusion] cache write failed:', upsertError.message);

    return jsonResponse({
      id: saved?.id ?? null,
      user_id: user.id,
      month,
      summary,
      insights,
      generated_at: saved?.generated_at ?? new Date().toISOString(),
      cached: false,
    });
  } catch (error: any) {
    console.error('[monthly-conclusion] Error:', error);
    const message = String(error?.message ?? '');
    const code = PASSTHROUGH_CODES.has(message) ? message : 'ANALYSIS_FAILED';
    return jsonResponse({ error: code }, code === 'UNAUTHORIZED' ? 401 : 400);
  }
});

/**
 * Gemini wraps JSON in prose or ```json fences often enough that a bare JSON.parse
 * throws on a perfectly good answer — which used to surface as a generic 400 and a
 * refunded credit. Slice to the outermost braces first (M-19).
 */
function extractJson(content: string): any {
  const cleaned = content.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('AI_INVALID_RESPONSE');

  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new Error('AI_INVALID_RESPONSE');
  }
}

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
    console.error(`[monthly-conclusion] Gemini API error ${response.status}:`, await response.text());
    throw new Error('AI_SERVICE_ERROR');
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  // On finishReason SAFETY/RECITATION/MAX_TOKENS the candidate exists with no text part,
  // so index the parts defensively instead of assuming [0].text (M-18).
  const part = candidate?.content?.parts?.find((p: any) => typeof p?.text === 'string');
  if (!part?.text) {
    console.error('[monthly-conclusion] empty Gemini response, finishReason:', candidate?.finishReason);
    throw new Error('AI_EMPTY_RESPONSE');
  }
  return part.text as string;
}
