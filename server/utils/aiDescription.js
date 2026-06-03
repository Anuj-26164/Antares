/**
 * AI helpers for event descriptions backed by Cloudflare Workers AI.
 *
 * Two operations:
 *  - generateEventDescription: build a fresh description from event metadata.
 *  - improveEventDescription:  rewrite/polish an existing description while
 *    preserving its facts.
 *
 * Both return a plain string suitable for the Event.description field
 * (max 2000 chars, enforced by the model schema).
 *
 * Public surface (function names, return types, error codes) is unchanged
 * from the previous Groq-backed implementation so the controller and route
 * keep working without modification.
 */
import { runCfChat } from './cfAi.js';

const MAX_DESCRIPTION_CHARS = 1800; // leave headroom under the 2000 schema cap

const SYSTEM_PROMPT =
  'You write concise, engaging descriptions for student events at IIT Roorkee ' +
  '(Indian Institute of Technology Roorkee). Assume the audience is IIT Roorkee ' +
  'students, faculty, and visiting participants, and that the event takes place ' +
  'on or is organised from the IIT Roorkee campus unless the user states otherwise. ' +
  'Tone: warm, modern, factual. No emojis. No markdown. No hype words like ' +
  '"unforgettable", "amazing", "epic". Keep it short: 1 to 2 short paragraphs, ' +
  '40–90 words total. Plain prose only. Do not invent specific names, venues, ' +
  'dates, departments, or clubs that were not provided. Output only the ' +
  'description text — no preamble, no headings, no quotes around the answer, ' +
  'and no trailing commentary or self-evaluation.';

function buildContextBlock({ title, category, date, tags }) {
  const lines = [];
  if (title) lines.push(`Title: ${title}`);
  if (category) lines.push(`Category: ${category}`);
  if (date) {
    const d = new Date(date);
    if (!Number.isNaN(d.getTime())) {
      lines.push(`Date: ${d.toISOString().slice(0, 10)}`);
    }
  }
  if (Array.isArray(tags) && tags.length) {
    lines.push(`Tags: ${tags.slice(0, 10).join(', ')}`);
  }
  return lines.join('\n');
}

async function callModel(userPrompt) {
  const text = await runCfChat({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    maxTokens: 512,
    temperature: 0.7,
  });

  // Hard-cap to fit Event.description schema.
  return text.length > MAX_DESCRIPTION_CHARS
    ? text.slice(0, MAX_DESCRIPTION_CHARS).trimEnd()
    : text;
}

/**
 * Generate a fresh event description from metadata.
 * @param {{ title: string, category?: string, date?: string|Date, tags?: string[] }} ctx
 * @returns {Promise<string>}
 */
export async function generateEventDescription(ctx) {
  const context = buildContextBlock(ctx);
  const prompt =
    `Write a description for a new event with the following details:\n\n` +
    `${context}\n\n` +
    `Cover what attendees can expect and the kind of audience it suits, in ` +
    `1–2 short paragraphs (40–90 words). Stay grounded in the details above ` +
    `— do not invent speakers, sponsors, or schedules.`;
  return callModel(prompt);
}

/**
 * Improve an existing description: tighten phrasing, fix grammar,
 * keep the original facts and intent.
 *
 * @param {string} existing
 * @param {{ title?: string, category?: string, date?: string|Date, tags?: string[] }} [ctx]
 * @returns {Promise<string>}
 */
export async function improveEventDescription(existing, ctx = {}) {
  const trimmed = (existing || '').trim();
  if (!trimmed) {
    const err = new Error('No existing description to improve');
    err.code = 'AI_BAD_INPUT';
    throw err;
  }

  const context = buildContextBlock(ctx);
  const contextSection = context ? `Event details:\n${context}\n\n` : '';

  const prompt =
    `${contextSection}` +
    `Rewrite the description below to be clearer, tighter, and more engaging ` +
    `while keeping every fact the author included. Do not add new facts. ` +
    `Do not change the meaning. Keep it short: 1–2 short paragraphs, ` +
    `40–90 words total.\n\n` +
    `Original description:\n"""\n${trimmed}\n"""`;

  return callModel(prompt);
}
