import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { compressImage, applyWatermark } from './imageProcessor.js';

/**
 * Helper to create a test image buffer of given dimensions.
 */
async function createTestImage(width, height) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 128, g: 128, b: 128 },
    },
  })
    .png()
    .toBuffer();
}

describe('compressImage', () => {
  it('converts image to WebP format', async () => {
    const input = await createTestImage(800, 600);
    const output = await compressImage(input);
    const metadata = await sharp(output).metadata();
    expect(metadata.format).toBe('webp');
  });

  it('resizes landscape image exceeding 2048px on longest side', async () => {
    const input = await createTestImage(4000, 2000);
    const output = await compressImage(input);
    const metadata = await sharp(output).metadata();
    expect(metadata.width).toBe(2048);
    expect(metadata.height).toBeLessThanOrEqual(2048);
  });

  it('resizes portrait image exceeding 2048px on longest side', async () => {
    const input = await createTestImage(1500, 3000);
    const output = await compressImage(input);
    const metadata = await sharp(output).metadata();
    expect(metadata.height).toBe(2048);
    expect(metadata.width).toBeLessThanOrEqual(2048);
  });

  it('does not upscale images smaller than 2048px', async () => {
    const input = await createTestImage(500, 400);
    const output = await compressImage(input);
    const metadata = await sharp(output).metadata();
    expect(metadata.width).toBe(500);
    expect(metadata.height).toBe(400);
  });

  it('returns a Buffer', async () => {
    const input = await createTestImage(100, 100);
    const output = await compressImage(input);
    expect(Buffer.isBuffer(output)).toBe(true);
  });
});

describe('applyWatermark', () => {
  it('returns a Buffer with watermark applied', async () => {
    const input = await createTestImage(800, 600);
    const output = await applyWatermark(input, {
      userName: 'John Doe',
      date: '2024-06-15',
    });
    expect(Buffer.isBuffer(output)).toBe(true);
  });

  it('preserves image dimensions after watermarking', async () => {
    const input = await createTestImage(1024, 768);
    const output = await applyWatermark(input, {
      userName: 'Jane',
      date: '2024-01-01',
    });
    const metadata = await sharp(output).metadata();
    expect(metadata.width).toBe(1024);
    expect(metadata.height).toBe(768);
  });

  it('handles special characters in userName safely', async () => {
    const input = await createTestImage(400, 300);
    const output = await applyWatermark(input, {
      userName: '<script>alert("xss")</script>',
      date: '2024-06-15',
    });
    expect(Buffer.isBuffer(output)).toBe(true);
  });
});
