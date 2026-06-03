import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./cfAi.js', () => ({
  runCfVisionChat: vi.fn(),
}));

vi.mock('sharp', () => {
  const chain = {
    rotate: vi.fn().mockReturnThis(),
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from([0xff, 0xd8, 0xff])),
  };
  return { default: vi.fn(() => chain) };
});

import { runCfVisionChat } from './cfAi.js';
import { sanitizeCaption, generateImageCaption } from './imageCaptioner.js';

describe('sanitizeCaption', () => {
  it('returns empty string for empty/invalid input', () => {
    expect(sanitizeCaption('')).toBe('');
    expect(sanitizeCaption(null)).toBe('');
    expect(sanitizeCaption(undefined)).toBe('');
    expect(sanitizeCaption(123)).toBe('');
  });

  it('trims whitespace', () => {
    expect(sanitizeCaption('   A photo of students.   ')).toBe('A photo of students.');
  });

  it('strips a leading "Caption:" preamble', () => {
    expect(sanitizeCaption('Caption: Students at a hackathon.'))
      .toBe('Students at a hackathon.');
  });

  it('strips "Here is the caption:" preamble', () => {
    expect(sanitizeCaption('Here is the caption: Students at a hackathon.'))
      .toBe('Students at a hackathon.');
    expect(sanitizeCaption("Here's a caption — Students coding."))
      .toBe('Students coding.');
  });

  it('strips wrapping quotes', () => {
    expect(sanitizeCaption('"Students at the lab."')).toBe('Students at the lab.');
    expect(sanitizeCaption("'Students at the lab.'")).toBe('Students at the lab.');
  });

  it('collapses runs of whitespace', () => {
    expect(sanitizeCaption('Students   coding\n\nin   the lab.'))
      .toBe('Students coding in the lab.');
  });

  it('hard-caps long output near the last sentence boundary', () => {
    const long = 'A. ' + 'Students are gathered around laptops in a brightly lit lab. '.repeat(20);
    const out = sanitizeCaption(long);
    expect(out.length).toBeLessThanOrEqual(280);
    expect(out.endsWith('.') || out.endsWith('…')).toBe(true);
  });

  it('falls back to ellipsis when no sentence break is available within budget', () => {
    const long = 'a'.repeat(400);
    const out = sanitizeCaption(long);
    expect(out.length).toBeLessThanOrEqual(281); // 280 + ellipsis
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('generateImageCaption', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects non-Buffer input', async () => {
    await expect(generateImageCaption('not a buffer'))
      .rejects.toThrow(/buffer must be a Buffer/);
  });

  it('returns a sanitized caption from the model response', async () => {
    runCfVisionChat.mockResolvedValue('Caption: Students working on laptops in a lab.');
    const result = await generateImageCaption(Buffer.from([1, 2, 3]));
    expect(result).toBe('Students working on laptops in a lab.');
  });

  it('forwards event metadata in the user prompt when provided', async () => {
    runCfVisionChat.mockResolvedValue('A vibrant scene from the festival.');
    await generateImageCaption(Buffer.from([1, 2, 3]), {
      eventCtx: { title: 'Thomso 2026', category: 'Cultural', date: '2026-10-12' },
    });
    const call = runCfVisionChat.mock.calls[0][0];
    const userMsg = call.messages.find((m) => m.role === 'user').content;
    expect(userMsg).toContain('Thomso 2026');
    expect(userMsg).toContain('Cultural');
    expect(userMsg).toContain('2026-10-12');
  });

  it('omits the context block when no metadata is given', async () => {
    runCfVisionChat.mockResolvedValue('Some caption.');
    await generateImageCaption(Buffer.from([1, 2, 3]));
    const call = runCfVisionChat.mock.calls[0][0];
    const userMsg = call.messages.find((m) => m.role === 'user').content;
    expect(userMsg).not.toContain('Context for this photo');
  });

  it('uses a moderate temperature suitable for natural-sounding prose', async () => {
    runCfVisionChat.mockResolvedValue('Some caption.');
    await generateImageCaption(Buffer.from([1, 2, 3]));
    const call = runCfVisionChat.mock.calls[0][0];
    expect(call.temperature).toBeGreaterThanOrEqual(0.3);
    expect(call.temperature).toBeLessThanOrEqual(0.6);
  });

  it('propagates classifier errors with their code', async () => {
    const err = new Error('boom');
    err.code = 'AI_HTTP';
    runCfVisionChat.mockRejectedValue(err);
    await expect(generateImageCaption(Buffer.from([1, 2, 3])))
      .rejects.toMatchObject({ code: 'AI_HTTP' });
  });
});
