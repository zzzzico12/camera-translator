// camera-translator用の翻訳プロキシ。
// ブラウザからDeepLキーを隠すため、キーはこの関数側(Vercel環境変数)にのみ保持する。
const ALLOWED_ORIGIN = 'https://zzzzico12.github.io';
const MAX_TEXT_LENGTH = 500;
const ALLOWED_TARGET_LANGS = new Set(['JA', 'EN']);

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
