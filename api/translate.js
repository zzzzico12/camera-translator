// camera-translator用の翻訳プロキシ。
// ブラウザからDeepLキーを隠すため、キーはこの関数側(Vercel環境変数)にのみ保持する。
const ALLOWED_ORIGIN = 'https://zzzzico12.github.io';
const MAX_TEXT_LENGTH = 500;
const ALLOWED_TARGET_LANGS = new Set(['JA', 'EN']);
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 20; // 1IPあたり1分間に許可するリクエスト数

// サーバーレス関数のウォームインスタンス内でのみ有効な簡易レート制限(ベストエフォート)。
// インスタンスが複数起動している場合は完全には防げないが、単純な連打・スクレイピングの抑止にはなる。
const requestLog = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  for (const [key, timestamps] of requestLog) {
    if (timestamps.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) requestLog.delete(key);
  }
  const timestamps = (requestLog.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT_MAX;
}

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (origin === ALLOWED_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
}

module.exports = async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  // ブラウザ以外からの直接呼び出し(curl等)やなりすましを弾く。
  // Originヘッダーはクライアント側で偽装可能だが、無防備な状態よりは悪用のハードルを上げられる。
  if (req.headers.origin !== ALLOWED_ORIGIN) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    res.status(429).json({ error: 'too many requests' });
    return;
  }

  const body = req.body || {};
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const targetLang = ALLOWED_TARGET_LANGS.has(body.target_lang) ? body.target_lang : 'JA';

  if (!text || text.length > MAX_TEXT_LENGTH) {
    res.status(400).json({ error: 'invalid text' });
    return;
  }

  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'server misconfigured' });
    return;
  }

  // DeepL Free/Developerキーは末尾が ":fx" になっており、専用エンドポイントを使う
  const endpoint = apiKey.endsWith(':fx')
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate';

  const params = new URLSearchParams();
  params.set('text', text);
  params.set('target_lang', targetLang);
  params.set('source_lang', targetLang === 'JA' ? 'EN' : 'JA');

  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!upstream.ok) {
      res.status(502).json({ error: 'upstream error' });
      return;
    }

    const data = await upstream.json();
    const translated = data && data.translations && data.translations[0] && data.translations[0].text;
    if (typeof translated !== 'string') {
      res.status(502).json({ error: 'unexpected upstream response' });
      return;
    }

    res.status(200).json({ translatedText: translated.slice(0, MAX_TEXT_LENGTH) });
  } catch (err) {
    res.status(500).json({ error: 'internal error' });
  }
};
