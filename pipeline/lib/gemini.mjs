import { loadEnv } from './env.mjs';

loadEnv();

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const MAX_RETRIES = 4;

// Ücretsiz katman: model BAŞINA günde 20 istek. Her modelin ayrı kovası
// olduğundan havuzu döndürerek günlük bütçeyi katlarız. Bir model günlük
// kotayı (PerDay 429) tüketince "dead" işaretlenir, sıradaki canlı modele geçilir.
const MODEL_POOL = (
  process.env.GEMINI_MODELS
    ? process.env.GEMINI_MODELS.split(',')
    : [
        'gemini-2.5-flash',
        'gemini-3.5-flash',
        'gemini-flash-latest',
        'gemini-3-flash-preview',
        'gemini-flash-lite-latest',
        'gemini-3.1-flash-lite',
      ]
).map((m) => m.trim());

const deadModels = new Set();

/** Verilen başlangıç modelinden itibaren canlı model listesi (havuzla birleşik). */
function liveModels(startModel) {
  const ordered = [startModel, ...MODEL_POOL.filter((m) => m !== startModel)];
  return ordered.filter((m) => !deadModels.has(m));
}

export function requireApiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      'GEMINI_API_KEY bulunamadı. Repo kökünde .env dosyası oluşturun (bkz. .env.example) ' +
        've AI Studio (https://aistudio.google.com/apikey) ücretsiz anahtarınızı girin.',
    );
  }
  return key;
}

/**
 * Calls Gemini generateContent and returns the text response.
 * Retries on 429/5xx with exponential backoff (free tier rate limits).
 */
export async function callGemini(prompt, { json = false, model = DEFAULT_MODEL } = {}) {
  const key = requireApiKey();
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.8,
      ...(json ? { responseMimeType: 'application/json' } : {}),
    },
  };

  let lastError;
  let backoff = 0; // aynı model içinde dakika-kotası/5xx için artan bekleme
  for (let attempt = 0; attempt < MAX_RETRIES * 3; attempt++) {
    const candidates = liveModels(model);
    if (candidates.length === 0) {
      throw new Error('Gemini HTTP 429: tüm modeller günlük kotayı tüketti (quota)');
    }
    const current = candidates[0];
    if (backoff > 0) {
      console.log(`  Gemini bekleme ${backoff / 1000}s (${current})...`);
      await new Promise((r) => setTimeout(r, backoff));
    }
    const res = await fetch(`${API_BASE}/${current}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 429) {
      // günlük kota -> modeli öldür, sıradakine geç (beklemeden); dakika kotası -> bekle
      let perDay = true;
      try {
        const b = await res.json();
        const ids = (b.error?.details || []).flatMap((d) => d.violations || []).map((v) => v.quotaId || '');
        if (ids.length && !ids.some((id) => /PerDay/i.test(id))) perDay = false;
      } catch {
        /* gövde okunamadı: güvenli tarafta günlük say */
      }
      lastError = new Error('Gemini HTTP 429');
      if (perDay) {
        deadModels.add(current);
        console.log(`  ${current} günlük kotayı tüketti -> sıradaki modele geçiliyor`);
        backoff = 0;
      } else {
        backoff = Math.min(60000, (backoff || 15000) * 1.5);
      }
      continue;
    }
    if (res.status >= 500) {
      lastError = new Error(`Gemini HTTP ${res.status}`);
      backoff = Math.min(30000, (backoff || 4000) * 2);
      continue;
    }
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Gemini HTTP ${res.status}: ${detail.slice(0, 400)}`);
    }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
    if (!text) {
      lastError = new Error('Gemini boş yanıt döndürdü');
      backoff = Math.min(30000, (backoff || 4000) * 2);
      continue;
    }
    return text;
  }
  throw lastError ?? new Error('Gemini çağrısı başarısız');
}

/** Parses a JSON response, tolerating markdown code fences. */
export function parseJsonResponse(text) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '');
  return JSON.parse(cleaned);
}
