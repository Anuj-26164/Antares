import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runCfImageClassify, DEFAULT_CF_VISION_MODEL } from './cfAi.js';

describe('runCfImageClassify', () => {
  let originalFetch;
  let originalEnv;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalEnv = { ...process.env };
    process.env.CF_ACCOUNT_ID = 'acct123';
    process.env.CF_AI_TOKEN = 'token123';
    delete process.env.CF_AI_VISION_MODEL;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
  });

  it('throws AI_UNAVAILABLE when credentials are missing', async () => {
    delete process.env.CF_ACCOUNT_ID;
    await expect(runCfImageClassify(Buffer.from([1])))
      .rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
  });

  it('throws AI_BAD_INPUT when the input is not a Buffer/Uint8Array', async () => {
    await expect(runCfImageClassify('definitely not bytes'))
      .rejects.toMatchObject({ code: 'AI_BAD_INPUT' });
  });

  it('posts the raw bytes to the configured Cloudflare endpoint', async () => {
    const json = vi.fn().mockResolvedValue({
      result: [{ label: 'alp', score: 0.7 }],
      success: true,
    });
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json });

    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const out = await runCfImageClassify(buf, { contentType: 'image/jpeg' });

    expect(out).toEqual([{ label: 'alp', score: 0.7 }]);
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe(
      `https://api.cloudflare.com/client/v4/accounts/acct123/ai/run/${DEFAULT_CF_VISION_MODEL}`
    );
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer token123');
    expect(init.headers['Content-Type']).toBe('image/jpeg');
    expect(init.body).toBe(buf);
  });

  it('honours the CF_AI_VISION_MODEL env override', async () => {
    process.env.CF_AI_VISION_MODEL = '@cf/meta/some-other-model';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: [{ label: 'x', score: 0.5 }] }),
    });
    await runCfImageClassify(Buffer.from([1]));
    expect(global.fetch.mock.calls[0][0]).toContain('@cf/meta/some-other-model');
  });

  it('throws AI_HTTP on non-2xx responses', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: () => Promise.resolve('boom'),
    });
    await expect(runCfImageClassify(Buffer.from([1])))
      .rejects.toMatchObject({ code: 'AI_HTTP', status: 500 });
  });

  it('throws AI_EMPTY when the API returns no usable predictions', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: [], success: true }),
    });
    await expect(runCfImageClassify(Buffer.from([1])))
      .rejects.toMatchObject({ code: 'AI_EMPTY' });
  });

  it('drops malformed entries from the predictions array', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        result: [
          { label: 'alp', score: 0.7 },
          { label: 'no-score' },
          null,
          { score: 0.4 },
          { label: 'beach', score: 0.5 },
        ],
        success: true,
      }),
    });
    const out = await runCfImageClassify(Buffer.from([1]));
    expect(out).toEqual([
      { label: 'alp', score: 0.7 },
      { label: 'beach', score: 0.5 },
    ]);
  });
});

import { runCfVisionChat, DEFAULT_CF_VISION_LLM_MODEL } from './cfAi.js';

describe('runCfVisionChat', () => {
  let originalFetch;
  let originalEnv;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalEnv = { ...process.env };
    process.env.CF_ACCOUNT_ID = 'acct123';
    process.env.CF_AI_TOKEN = 'token123';
    delete process.env.CF_AI_VISION_LLM_MODEL;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
  });

  it('throws AI_UNAVAILABLE when credentials are missing', async () => {
    delete process.env.CF_ACCOUNT_ID;
    await expect(runCfVisionChat({
      imageBytes: Buffer.from([1]),
      messages: [{ role: 'user', content: 'hi' }],
    })).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
  });

  it('throws AI_BAD_INPUT when imageBytes is missing', async () => {
    await expect(runCfVisionChat({
      messages: [{ role: 'user', content: 'hi' }],
    })).rejects.toMatchObject({ code: 'AI_BAD_INPUT' });
  });

  it('throws AI_BAD_INPUT when messages is empty', async () => {
    await expect(runCfVisionChat({
      imageBytes: Buffer.from([1]),
      messages: [],
    })).rejects.toMatchObject({ code: 'AI_BAD_INPUT' });
  });

  it('posts messages + image-as-byte-array to the vision LLM endpoint', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: { response: 'hackathon, coding' } }),
    });

    const out = await runCfVisionChat({
      imageBytes: Buffer.from([0xff, 0xd8, 0xff]),
      messages: [
        { role: 'system', content: 'tag the image' },
        { role: 'user',   content: 'go' },
      ],
    });

    expect(out).toBe('hackathon, coding');
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe(
      `https://api.cloudflare.com/client/v4/accounts/acct123/ai/run/${DEFAULT_CF_VISION_LLM_MODEL}`
    );
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer token123');
    expect(init.headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(init.body);
    expect(body.messages).toHaveLength(2);
    expect(Array.isArray(body.image)).toBe(true);
    expect(body.image).toEqual([0xff, 0xd8, 0xff]);
  });

  it('honours the CF_AI_VISION_LLM_MODEL env override', async () => {
    process.env.CF_AI_VISION_LLM_MODEL = '@cf/test/some-vlm';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: { response: 'crowd' } }),
    });
    await runCfVisionChat({
      imageBytes: Buffer.from([1]),
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(global.fetch.mock.calls[0][0]).toContain('@cf/test/some-vlm');
  });

  it('throws AI_HTTP on non-2xx', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Unavailable',
      text: () => Promise.resolve('overloaded'),
    });
    await expect(runCfVisionChat({
      imageBytes: Buffer.from([1]),
      messages: [{ role: 'user', content: 'hi' }],
    })).rejects.toMatchObject({ code: 'AI_HTTP', status: 503 });
  });

  it('throws AI_EMPTY when the response has no text', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: { response: '   ' } }),
    });
    await expect(runCfVisionChat({
      imageBytes: Buffer.from([1]),
      messages: [{ role: 'user', content: 'hi' }],
    })).rejects.toMatchObject({ code: 'AI_EMPTY' });
  });
});
