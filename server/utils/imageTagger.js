/**
 * Smart image tagging for ANTARES — tuned for campus event photos.
 *
 * Pipeline:
 *   1. Take a Buffer for an image (typically the just-uploaded original).
 *   2. Resize to a small JPEG via sharp — vision LLMs work fine with low-res
 *      input for tagging, and a small payload keeps token cost predictable.
 *   3. Send to a Cloudflare Workers AI vision model
 *      (@cf/meta/llama-3.2-11b-vision-instruct by default) along with a
 *      system prompt that pins the model to the curated CAMPUS_TAGS list.
 *   4. Optional: include event metadata (title, category, date) so the model
 *      can disambiguate when the visual signal is weak (e.g. "presentation"
 *      vs "panel discussion" at a tech event).
 *   5. Parse the comma-separated response, normalise, drop anything outside
 *      the vocabulary, dedupe, and cap at MAX_TAGS.
 *
 * Failures (config missing, HTTP error, empty result) bubble as Errors with
 * a `code` field — callers should treat tagging as best-effort and log on
 * failure rather than reject the upload.
 *
 * NOTE on Llama 3.2 Vision: Cloudflare requires a one-time license-agree
 * request before the model can be used. From a shell with CF creds set:
 *
 *   curl https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/ai/run/@cf/meta/llama-3.2-11b-vision-instruct \
 *     -X POST -H "Authorization: Bearer $CF_AI_TOKEN" \
 *     -d '{"prompt":"agree"}'
 *
 * After that, normal calls succeed.
 */

import sharp from 'sharp';
import { runCfVisionChat } from './cfAi.js';

const TAGGER_INPUT_DIM = 512;
const MAX_TAGS = 5;

/**
 * Curated vocabulary for ANTARES (IIT Roorkee campus events).
 *
 * The model is instructed to choose only from this list. Keeping it tight
 * (≤45 entries) helps the model stay on-vocabulary and produces consistent
 * output across uploads. To extend: add entries here — no other code change
 * required, the parser auto-picks them up.
 */
export const CAMPUS_TAGS = [
  // Performance & Arts
  'stage performance',
  'dance',
  'group dance',
  'solo dance',
  'music performance',
  'singing',
  'band',
  'orchestra',
  'instrumental',
  'theatre',
  'drama',
  'fashion show',
  'art exhibit',
  'painting',
  'photography exhibition',
  'open mic',
  'poetry',
  'cultural performance',

  // Sports
  'sports',
  'cricket',
  'football',
  'basketball',
  'volleyball',
  'badminton',
  'table tennis',
  'tennis',
  'athletics',
  'relay race',
  'marathon',
  'kabaddi',
  'chess',
  'esports',
  'tournament',
  'match',
  'training session',
  'victory celebration',

  // Technology
  'hackathon',
  'coding',
  'programming',
  'software development',
  'robotics',
  'ai',
  'machine learning',
  'cybersecurity',
  'tech talk',
  'developer meetup',
  'project showcase',
  'innovation challenge',
  'startup pitch',

  // Academic
  'lecture',
  'seminar',
  'conference',
  'panel discussion',
  'workshop',
  'presentation',
  'poster session',
  'research',
  'science exhibit',
  'academic event',
  'classroom activity',
  'faculty session',
  'student project',

  // Clubs & Organizations
  'club activity',
  'student council',
  'volunteer activity',
  'community service',
  'ngo event',
  'leadership program',
  'orientation',
  'recruitment drive',

  // Social & Cultural
  'crowd',
  'group photo',
  'team photo',
  'friends',
  'networking',
  'festival',
  'celebration',
  'traditional attire',
  'cultural',
  'food stall',
  'decorations',
  'campus fest',
  'fun activity',

  // Ceremonies
  'award ceremony',
  'prize distribution',
  'certificate presentation',
  'inauguration',
  'graduation',
  'convocation',
  'keynote',
  'chief guest',
  'ribbon cutting',
  'felicitation',

  // Campus Locations
  'campus',
  'auditorium',
  'classroom',
  'library',
  'laboratory',
  'sports ground',
  'conference hall',
  'cafeteria',
  'hostel',
  'open area',
  'amphitheatre',

  // Event Atmosphere
  'indoor',
  'outdoor',
  'night event',
  'daytime',
  'stage',
  'audience',
  'speaker',
  'spotlight',
  'exhibition',
  'booth',
  'registration desk',

  // People
  'students',
  'faculty',
  'speaker',
  'guest',
  'organizer',
  'participant',
  'judge',
  'mentor',
  'volunteer',
  'alumni',

  // Photography Style
  'portrait',
  'candid',
  'action shot',
  'group shot',
  'close up',
  'wide shot',
  'event coverage',
  'behind the scenes',

  // Achievement & Recognition
  'winner',
  'runner up',
  'trophy',
  'medal',
  'certificate',
  'achievement',
  'recognition',

  // Miscellaneous
  'teamwork',
  'collaboration',
  'discussion',
  'brainstorming',
  'networking',
  'innovation', 
  'leadership',
  'creativity'
];

/**
 * Lookup map for parser: lowercase tag → canonical tag string.
 * Built once at module load.
 */
const TAG_LOOKUP = new Map(CAMPUS_TAGS.map((t) => [t.toLowerCase(), t]));

const SYSTEM_PROMPT = [
  'You are an image tagger for a college event media platform (IIT Roorkee).',
  'Your job: look at the photo and pick the 3 to 5 tags from the provided list',
  'that best describe what is happening in the image. Use ONLY tags from the',
  'list — do not invent new tags, do not paraphrase, do not include synonyms.',
  '',
  'Output rules:',
  '- Return tags as a comma-separated list, lowercase, no quotes, no numbering.',
  '- No extra commentary, no preamble, no trailing punctuation.',
  '- If the image clearly shows none of the listed concepts, return an empty line.',
  '- Prefer specific tags (e.g. "hackathon", "music performance") over generic',
  '  ones ("indoor", "crowd") when both apply.',
  '',
  `Allowed tags: ${CAMPUS_TAGS.join(', ')}.`,
].join('\n');

/**
 * Build the user-message text. Optionally includes event metadata so the
 * model has hints when the image alone is ambiguous.
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
  lines.push('Pick the best 3–5 tags from the allowed list that describe this photo.');
  return lines.join('\n');
}

/**
 * Resize and re-encode the input image to a small JPEG. Decoding-then-encoding
 * also normalises odd inputs (HEIC, CMYK JPEGs, EXIF-rotated images) to a
 * clean RGB byte stream the vision model can read.
 *
 * @param {Buffer} buffer
 * @returns {Promise<Buffer>}
 */
async function prepareForVision(buffer) {
  return sharp(buffer)
    .rotate() // honour EXIF orientation
    .resize(TAGGER_INPUT_DIM, TAGGER_INPUT_DIM, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80 })
    .toBuffer();
}

/**
 * Parse the model's free-text response into a clean, vocab-only tag list.
 *
 * Tolerates the model emitting:
 *   - "tag1, tag2, tag3"
 *   - "tag1\ntag2\ntag3"
 *   - "1. tag1\n2. tag2"
 *   - "Tags: tag1, tag2"
 *   - quoted, capitalised, or whitespace-padded entries
 *
 * @param {string} raw  Raw assistant text.
 * @returns {string[]}  Up to MAX_TAGS canonical tags from CAMPUS_TAGS.
 */
export function parseTagResponse(raw) {
  if (!raw || typeof raw !== 'string') return [];

  // Strip a leading "Tags:" label if the model added one.
  const stripped = raw.replace(/^\s*tags\s*[:\-]\s*/i, '');

  // Split on commas and newlines so both list styles work.
  const candidates = stripped
    .split(/[,\n]+/)
    .map((s) => s.trim())
    // Drop list-style numbering / bullets / surrounding quotes
    .map((s) => s.replace(/^\s*\d+[.)]\s*/, '').replace(/^[-*•]\s*/, ''))
    .map((s) => s.replace(/^["'`]+|["'`]+$/g, ''))
    .map((s) => s.toLowerCase())
    .filter(Boolean);

  const seen = new Set();
  const result = [];
  for (const c of candidates) {
    const canonical = TAG_LOOKUP.get(c);
    if (!canonical) continue;
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    result.push(canonical);
    if (result.length >= MAX_TAGS) break;
  }
  return result;
}

/**
 * Generate smart tags for a campus-event photo. Best-effort — callers should
 * treat a thrown error as a non-fatal "skip tagging" signal.
 *
 * @param {Buffer} buffer  Original image bytes (any format sharp can decode).
 * @param {object} [opts]
 * @param {{ title?: string, category?: string, date?: string|Date }} [opts.eventCtx]
 *        Event metadata to bias the model when the image is ambiguous.
 * @param {string} [opts.model]  Override the vision model.
 * @returns {Promise<string[]>}  Curated campus tags, possibly empty.
 */
export async function generateImageTags(buffer, opts = {}) {
  if (!Buffer.isBuffer(buffer)) {
    const err = new Error('generateImageTags: buffer must be a Buffer');
    err.code = 'AI_BAD_INPUT';
    throw err;
  }

  const small = await prepareForVision(buffer);
  const userPrompt = buildUserPrompt(opts.eventCtx);

  const response = await runCfVisionChat({
    imageBytes: small,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    maxTokens: 64,
    temperature: 0.1,
    model: opts.model,
  });

  return parseTagResponse(response);
}
