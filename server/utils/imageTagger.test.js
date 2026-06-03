import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./cfAi.js', () => ({
  runCfVisionChat: vi.fn(),
}));

// Keep sharp as a no-op chain so we can run without real image bytes.
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
import { parseTagResponse, generateImageTags, CAMPUS_TAGS } from './imageTagger.js';

describe('parseTagResponse', () => {
  it('parses a clean comma-separated list', () => {
    expect(parseTagResponse('hackathon, coding, indoor'))
      .toEqual(['hackathon', 'coding', 'indoor']);
  });

  it('parses a newline-separated list', () => {
    expect(parseTagResponse('hackathon\ncoding\nindoor'))
      .toEqual(['hackathon', 'coding', 'indoor']);
  });

  it('strips a leading "Tags:" label', () => {
    expect(parseTagResponse('Tags: dance, music performance, crowd'))
      .toEqual(['dance', 'music performance', 'crowd']);
  });

  it('handles numbered lists', () => {
    const raw = '1. cricket\n2. sports\n3. action shot';
    expect(parseTagResponse(raw)).toEqual(['cricket', 'sports', 'action shot']);
  });

  it('handles bulleted lists', () => {
    const raw = '- group photo\n- portrait\n- candid';
    expect(parseTagResponse(raw)).toEqual(['group photo', 'portrait', 'candid']);
  });

  it('strips quotes around tags', () => {
    expect(parseTagResponse('"hackathon", "coding"'))
      .toEqual(['hackathon', 'coding']);
  });

  it('is case-insensitive but returns canonical (lowercase) tags', () => {
    expect(parseTagResponse('HACKATHON, Coding, Group Photo'))
      .toEqual(['hackathon', 'coding', 'group photo']);
  });

  it('drops tags that are not in the campus vocabulary', () => {
    expect(parseTagResponse('hackathon, mountains, beaches, coding'))
      .toEqual(['hackathon', 'coding']);
  });

  it('deduplicates repeated tags', () => {
    expect(parseTagResponse('crowd, Crowd, CROWD, sports'))
      .toEqual(['crowd', 'sports']);
  });

  it('caps the result at MAX_TAGS (5)', () => {
    const raw = 'hackathon, coding, laboratory, presentation, workshop, lecture, indoor';
    const result = parseTagResponse(raw);
    expect(result.length).toBe(5);
    expect(result).toEqual(['hackathon', 'coding', 'laboratory', 'presentation', 'workshop']);
  });

  it('returns empty array for empty/null/whitespace input', () => {
    expect(parseTagResponse('')).toEqual([]);
    expect(parseTagResponse(null)).toEqual([]);
    expect(parseTagResponse(undefined)).toEqual([]);
    expect(parseTagResponse('   ')).toEqual([]);
  });

  it('returns empty array when the model says nothing matches', () => {
    expect(parseTagResponse('none of the listed concepts apply')).toEqual([]);
  });

  it('every entry in CAMPUS_TAGS round-trips through the parser', () => {
    for (const tag of CAMPUS_TAGS) {
      expect(parseTagResponse(tag)).toEqual([tag]);
    }
  });
});

describe('generateImageTags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects non-Buffer input', async () => {
    await expect(generateImageTags('not a buffer'))
      .rejects.toThrow(/buffer must be a Buffer/);
  });

  it('returns canonical tags from the model response', async () => {
    runCfVisionChat.mockResolvedValue('hackathon, coding, group photo');
    const result = await generateImageTags(Buffer.from([1, 2, 3]));
    expect(runCfVisionChat).toHaveBeenCalledTimes(1);
    expect(result).toEqual(['hackathon', 'coding', 'group photo']);
  });

  it('includes event metadata in the user prompt when provided', async () => {
    runCfVisionChat.mockResolvedValue('hackathon, coding');
    await generateImageTags(Buffer.from([1, 2, 3]), {
      eventCtx: {
        title: 'Cognizance 2026',
        category: 'Hackathon',
        date: '2026-03-15',
      },
    });

    const call = runCfVisionChat.mock.calls[0][0];
    const userMsg = call.messages.find((m) => m.role === 'user').content;
    expect(userMsg).toContain('Cognizance 2026');
    expect(userMsg).toContain('Hackathon');
    expect(userMsg).toContain('2026-03-15');
  });

  it('omits the context block when no event metadata is given', async () => {
    runCfVisionChat.mockResolvedValue('crowd');
    await generateImageTags(Buffer.from([1, 2, 3]));
    const call = runCfVisionChat.mock.calls[0][0];
    const userMsg = call.messages.find((m) => m.role === 'user').content;
    expect(userMsg).not.toContain('Context for this photo');
  });

  it('always sends a system prompt naming the campus vocabulary', async () => {
    runCfVisionChat.mockResolvedValue('crowd');
    await generateImageTags(Buffer.from([1, 2, 3]));
    const call = runCfVisionChat.mock.calls[0][0];
    const sysMsg = call.messages.find((m) => m.role === 'system').content;
    expect(sysMsg).toContain('hackathon');
    expect(sysMsg).toContain('stage performance');
    expect(sysMsg).toContain('Allowed tags:');
  });

  it('propagates classifier errors with their code', async () => {
    const err = new Error('AI service is not configured');
    err.code = 'AI_UNAVAILABLE';
    runCfVisionChat.mockRejectedValue(err);

    await expect(generateImageTags(Buffer.from([1, 2, 3])))
      .rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
  });

  it('returns [] when the model emits an off-vocabulary response', async () => {
    runCfVisionChat.mockResolvedValue('mountains, beaches, sunset');
    const result = await generateImageTags(Buffer.from([1, 2, 3]));
    expect(result).toEqual([]);
  });

  it('uses low temperature for deterministic tagging', async () => {
    runCfVisionChat.mockResolvedValue('crowd');
    await generateImageTags(Buffer.from([1, 2, 3]));
    const call = runCfVisionChat.mock.calls[0][0];
    expect(call.temperature).toBeLessThanOrEqual(0.2);
  });
});
