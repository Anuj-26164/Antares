/**
 * Cloudflare Workers AI client.
 *
 * Calls the public REST endpoint:
 *   https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/run/{model}
 *
 * Auth: Bearer token (account-scoped API token with the
 * "Workers AI" → "Read" or higher permission).
 *
 * The chat models accept the OpenAI-style { messages: [...] } payload and
 * return { result: { response: "<text>" } }. We wrap that into a small,
 * stable interface so callers don't need to know the wire format.
 *
 * Configure via env:
 *   CF_ACCOUNT_ID       — required
 *   CF_AI_TOKEN         — required
 *   CF_AI_MODEL         — optional override (defaults to llama 3.3 70B fp8 fast)
 *   CF_AI_VISION_MODEL  — optional override for image models (defaults to resnet-50)
 */

export const DEFAULT_CF_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
export const DEFAULT_CF_VISION_MODEL = '@cf/microsoft/resnet-50';
export const DEFAULT_CF_VISION_LLM_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';

/**
 * @returns {{ accountId: string, token: string, model: string } | null}
 *   Configuration object, or null if Cloudflare AI is not configured.
 */
export function getCfAiConfig() {
  const accountId = process.env.CF_ACCOUNT_ID;
  const token = process.env.CF_AI_TOKEN;
  if (!accountId || !token) {
    if (!getCfAiConfig._warned) {
      console.warn(
        '[cf-ai] CF_ACCOUNT_ID and/or CF_AI_TOKEN not set — AI features disabled'
      );
      getCfAiConfig._warned = true;
    }
    return null;
  }
  return {
    accountId,
    token,
    model: process.env.CF_AI_MODEL || DEFAULT_CF_MODEL,
  };
}

/**
 * Run a chat completion against Cloudflare Workers AI.
 *
 * @param {object} args
 * @param {Array<{ role: 'system'|'user'|'assistant', content: string }>} args.messages
 * @param {number} [args.maxTokens=512]   - Cap on tokens generated.
 * @param {number} [args.temperature=0.7] - Sampling temperature.
 * @param {string} [args.model]           - Override the configured model.
 * @returns {Promise<string>} Trimmed assistant text.
 *
 * Throws an Error with `code` set to one of:
 *   AI_UNAVAILABLE - Cloudflare creds not configured
 *   AI_HTTP        - Non-2xx response from Cloudflare
 *   AI_EMPTY       - 2xx response but no usable text in the body
 */
export async function runCfChat({
  messages,
  maxTokens = 512,
  temperature = 0.7,
  model,
}) {
  const cfg = getCfAiConfig();
  if (!cfg) {
    const err = new Error('AI service is not configured');
    err.code = 'AI_UNAVAILABLE';
    throw err;
  }

  const useModel = model || cfg.model;
  const url = `https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/ai/run/${useModel}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
    });
  } catch (networkErr) {
    const err = new Error(`Cloudflare AI request failed: ${networkErr.message}`);
    err.code = 'AI_HTTP';
    throw err;
  }

  if (!response.ok) {
    let detail = '';
    try { detail = await response.text(); } catch {}
    const err = new Error(
      `Cloudflare AI returned ${response.status} ${response.statusText}` +
        (detail ? ` — ${detail.slice(0, 300)}` : '')
    );
    err.code = 'AI_HTTP';
    err.status = response.status;
    throw err;
  }

  const json = await response.json();
  // Workers AI shape: { result: { response: "..." }, success: true, errors: [] }
  // Some models return { result: { response: "...", usage: {...} } }.
  const text =
    typeof json?.result === 'string'
      ? json.result
      : json?.result?.response ?? '';

  const trimmed = String(text).trim();
  if (!trimmed) {
    const err = new Error('AI returned an empty response');
    err.code = 'AI_EMPTY';
    throw err;
  }

  return trimmed;
}

/**
 * Run an image classification model against Cloudflare Workers AI.
 *
 * Cloudflare's image-classification models (e.g. resnet-50) accept the raw
 * image bytes as the request body and return:
 *   { result: [{ label: 'tabby cat', score: 0.91 }, ...], success: true }
 *
 * @param {Buffer|Uint8Array} imageBytes
 * @param {object} [options]
 * @param {string} [options.model]                - override default vision model
 * @param {string} [options.contentType='application/octet-stream']
 * @returns {Promise<Array<{ label: string, score: number }>>}
 *
 * Throws an Error with `code` set to one of:
 *   AI_UNAVAILABLE | AI_HTTP | AI_EMPTY | AI_BAD_INPUT
 *   (mirrors runCfChat semantics).
 */
export async function runCfImageClassify(
  imageBytes,
  { model, contentType = 'application/octet-stream' } = {}
) {
  const cfg = getCfAiConfig();
  if (!cfg) {
    const err = new Error('AI service is not configured');
    err.code = 'AI_UNAVAILABLE';
    throw err;
  }

  if (!imageBytes || (!Buffer.isBuffer(imageBytes) && !(imageBytes instanceof Uint8Array))) {
    const err = new Error('runCfImageClassify: imageBytes must be a Buffer or Uint8Array');
    err.code = 'AI_BAD_INPUT';
    throw err;
  }

  const useModel = model || process.env.CF_AI_VISION_MODEL || DEFAULT_CF_VISION_MODEL;
  const url = `https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/ai/run/${useModel}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        'Content-Type': contentType,
      },
      body: imageBytes,
    });
  } catch (networkErr) {
    const err = new Error(`Cloudflare AI request failed: ${networkErr.message}`);
    err.code = 'AI_HTTP';
    throw err;
  }

  if (!response.ok) {
    let detail = '';
    try { detail = await response.text(); } catch {}
    const err = new Error(
      `Cloudflare AI returned ${response.status} ${response.statusText}` +
        (detail ? ` — ${detail.slice(0, 300)}` : '')
    );
    err.code = 'AI_HTTP';
    err.status = response.status;
    throw err;
  }

  const json = await response.json();
  const result = Array.isArray(json?.result) ? json.result : null;
  if (!result || result.length === 0) {
    const err = new Error('AI returned no classification results');
    err.code = 'AI_EMPTY';
    throw err;
  }

  // Normalise — keep only entries with both a label and a numeric score.
  return result
    .filter((r) => r && typeof r.label === 'string' && typeof r.score === 'number')
    .map((r) => ({ label: r.label, score: r.score }));
}

/**
 * Run a vision chat completion against a Cloudflare Workers AI multimodal
 * model (e.g. @cf/meta/llama-3.2-11b-vision-instruct).
 *
 * The Workers AI vision API accepts the image as a top-level `image` field
 * alongside the standard `messages` array. Image bytes are sent as an
 * array of byte values (Cloudflare's documented format for these models).
 *
 * @param {object} args
 * @param {Buffer|Uint8Array} args.imageBytes
 * @param {Array<{ role: 'system'|'user'|'assistant', content: string }>} args.messages
 * @param {number} [args.maxTokens=256]
 * @param {number} [args.temperature=0.2]   Lower default than chat — vision
 *                                          tagging benefits from determinism.
 * @param {string} [args.model]             Override the configured vision LLM.
 * @returns {Promise<string>}                Trimmed assistant text.
 *
 * Throws an Error with `code` set to one of:
 *   AI_UNAVAILABLE | AI_HTTP | AI_EMPTY | AI_BAD_INPUT
 */
export async function runCfVisionChat({
  imageBytes,
  messages,
  maxTokens = 256,
  temperature = 0.2,
  model,
}) {
  const cfg = getCfAiConfig();
  if (!cfg) {
    const err = new Error('AI service is not configured');
    err.code = 'AI_UNAVAILABLE';
    throw err;
  }

  if (!imageBytes || (!Buffer.isBuffer(imageBytes) && !(imageBytes instanceof Uint8Array))) {
    const err = new Error('runCfVisionChat: imageBytes must be a Buffer or Uint8Array');
    err.code = 'AI_BAD_INPUT';
    throw err;
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    const err = new Error('runCfVisionChat: messages must be a non-empty array');
    err.code = 'AI_BAD_INPUT';
    throw err;
  }

  const useModel = model || process.env.CF_AI_VISION_LLM_MODEL || DEFAULT_CF_VISION_LLM_MODEL;
  const url = `https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/ai/run/${useModel}`;

  // Cloudflare expects a plain JSON-serialisable array of byte values for
  // the image. Array.from on Buffer/Uint8Array yields the same shape.
  const imageArray = Array.from(imageBytes);

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        image: imageArray,
        max_tokens: maxTokens,
        temperature,
      }),
    });
  } catch (networkErr) {
    const err = new Error(`Cloudflare AI request failed: ${networkErr.message}`);
    err.code = 'AI_HTTP';
    throw err;
  }

  if (!response.ok) {
    let detail = '';
    try { detail = await response.text(); } catch {}
    const err = new Error(
      `Cloudflare AI returned ${response.status} ${response.statusText}` +
        (detail ? ` — ${detail.slice(0, 300)}` : '')
    );
    err.code = 'AI_HTTP';
    err.status = response.status;
    throw err;
  }

  const json = await response.json();
  const text =
    typeof json?.result === 'string'
      ? json.result
      : json?.result?.response ?? '';

  const trimmed = String(text).trim();
  if (!trimmed) {
    const err = new Error('AI returned an empty response');
    err.code = 'AI_EMPTY';
    throw err;
  }

  return trimmed;
}
