/**
 * AI image captioning for ANTARES.
 *
 * Generates a short (2–3 line) human-friendly caption for a campus event
 * photo when the uploader leaves the caption field blank. Uses the same
 * Cloudflare vision LLM as the smart tagger.
 *
 * Pipeline:
 *   1. Resize the image to a small JPEG via sharp (consistent with the tagger).
 *   2. Send to @cf/meta/llama-3.2-11b-vision-instruct with a tight
 *      caption-style system prompt and optional event metadata.
 *   3. Trim, hard-cap to MAX_CAPTION_CHARS, drop trailing junk.
 *
 * Failures bubble as Errors with a `code` field. The caller treats this as
 * best-effort — a failed AI caption simply leaves caption empty rather than
 * blocking the upload.
 */

import sharp from 'sharp';
import { runCfVisionChat } from './cfAi.js';

const CAPTIONER_INPUT_DIM = 512;
const MAX_CAPTION_CHARS = 280; // fits "2–3 short lines" comfortably

const SYSTEM_PROMPT = [
  'You write short captions for photos taken at IIT Roorkee campus events.',
  'Write 2 to 3 short sentences (40–60 words total) describing what is in',
  'the photo, in a warm, factual tone.',
  '',
  'Rules:',
  '- No emojis, no markdown, no hashtags, no quotes around the answer.',
  '- No hype words ("amazing", "epic", "unforgettable").',
  '- Do not invent specific names, dates, departments, sponsors, or speakers',
  '  that you cannot see in the image. Stay grounded in what is visible.',
  '- Output only the caption text. No preamble. No headings.',
].join('\n');

/**
 * Build the user prompt. Optionally includes event metadata so the caption
 * can ground itself in the event context (e.g. "at the cultural night").
 *
 * @param {{ title?: string, category?: string, date?: string|Date }} [eventCtx]
 */
function buildUserPrompt(eventCtx = {}) {
  const lines = [];
  const { title, category, date } = eventCtx;
  if (title || category || date) {
    lines.push('Context for this photo (the event it belongs to):');
    if (title) lines.push(`- Event: ${title}`);
    if (category) lines.push(`- Category: ${category}`);
    if (date) {
      const d = new Date(date);
      if (!Number.isNaN(d.getTime())) {
        lines.push(`- Date: ${d.toISOString().slice(0, 10)}`);
      }
    }
    lines.push('');
  }
  lines.push('Write a 2–3 sentence caption for this photo.');
  return lines.join('\n');
}

async function prepareForVision(buffer) {
  return sharp(buffer)
    .rotate()
    .resize(CAPTIONER_INPUT_DIM, CAPTIONER_INPUT_DIM, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80 })
    .toBuffer();
}

/**
 * Tidy up the model output. Strips wrapping quotes, removes any leading
 * "Caption:" / "Here is the caption:" preamble, collapses whitespace,
 * and hard-caps length.
 *
 * @param {string} raw
 */
export function sanitizeCaption(raw) {
  if (!raw || typeof raw !== 'string') return '';

  let text = raw.trim();
  // Drop a "Caption:" / "Here is..." preamble line if the model added one.
  text = text.replace(/^\s*(?:caption|here(?:'s| is) (?:a |the )?(?:caption|description))[\s:\-—]*/i, '');
  // Strip wrapping quotes/backticks.
  text = text.replace(/^["'`]+|["'`]+$/g, '');
  // Collapse runs of whitespace, but preserve sentence boundaries.
  text = text.replace(/\s+/g, ' ').trim();

  if (text.length > MAX_CAPTION_CHARS) {
    // Cut at the last sentence boundary that fits, otherwise hard-cut.
    const slice = text.slice(0, MAX_CAPTION_CHARS);
    const lastSentence = Math.max(
      slice.lastIndexOf('. '),
      slice.lastIndexOf('! '),
      slice.lastIndexOf('? ')
    );
    text = lastSentence > 80
      ? slice.slice(0, lastSentence + 1).trim()
      : slice.trimEnd() + '…';
  }

  return text;
}

/**
 * Generate a short AI caption for a campus-event photo. Best-effort —
 * callers should treat a thrown error as a non-fatal "skip captioning"
 * signal (caption stays empty).
 *
 * @param {Buffer} buffer
 * @param {object} [opts]
 * @param {{ title?: string, category?: string, date?: string|Date }} [opts.eventCtx]
 * @param {string} [opts.model]
 * @returns {Promise<string>}
 */
export async function generateImageCaption(buffer, opts = {}) {
  if (!Buffer.isBuffer(buffer)) {
    const err = new Error('generateImageCaption: buffer must be a Buffer');
    err.code = 'AI_BAD_INPUT';
    throw err;
  }

  const small = await prepareForVision(buffer);
  const userPrompt = buildUserPrompt(opts.eventCtx);

  const response = await runCfVisionChat({
    imageBytes: small,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: userPrompt },
    ],
    maxTokens: 160,
    temperature: 0.4,
    model: opts.model,
  });

  return sanitizeCaption(response);
}
