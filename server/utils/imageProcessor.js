import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const MAX_DIMENSION = 2048;
const AVATAR_MAX_DIMENSION = 512;

/**
 * Compress an image to max 2048px on its longest side and convert to WebP.
 */
export async function compressImage(inputBuffer) {
  const image = sharp(inputBuffer);
  const metadata = await image.metadata();
  const { width, height } = metadata;
  const resizeOptions = {};
  if (width && height) {
    if (width >= height && width > MAX_DIMENSION) resizeOptions.width = MAX_DIMENSION;
    else if (height > width && height > MAX_DIMENSION) resizeOptions.height = MAX_DIMENSION;
  }
  let pipeline = image;
  if (resizeOptions.width || resizeOptions.height) {
    pipeline = pipeline.resize({ ...resizeOptions, fit: 'inside', withoutEnlargement: true });
  }
  return pipeline.webp({ quality: 80 }).toBuffer();
}

/**
 * Compress an avatar image to fit within 512×512 bounding box and convert to WebP.
 */
export async function compressAvatar(inputBuffer) {
  return sharp(inputBuffer)
    .resize({ width: AVATAR_MAX_DIMENSION, height: AVATAR_MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}

/**
 * Role-based watermark opacity config.
 * Single centered watermark — needs to be visible but not obtrusive.
 */
const ROLE_OPACITY = {
  admin:        0.18,
  photographer: 0.22,
  club_member:  0.28,
  viewer:       0.32,
};

function getOpacity(role) {
  return ROLE_OPACITY[role] ?? 0.30;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Build a repeated diagonal watermark SVG overlay.
 *
 * @param {number} width  - Image width in px
 * @param {number} height - Image height in px
 * @param {object} ctx    - Watermark context
 * @param {string} ctx.clubName   - e.g. "Antares"
 * @param {string} ctx.eventName  - e.g. "Hackathon 2025"
 * @param {string} ctx.userName   - e.g. "Anuj Sacer"
 * @param {string} ctx.userRole   - e.g. "club_member"
 * @param {string} ctx.timestamp  - e.g. "2025-05-28"
 * @returns {Buffer} SVG buffer
 */
/**
 * Build a single centered watermark SVG overlay.
 */
/**
 * Build a centered diagonal watermark overlay as a PNG buffer using
 * Sharp's Pango text renderer. This avoids librsvg font issues entirely —
 * Pango always has a working fallback font on any Linux system.
 *
 * @param {number} width  - Image width in px
 * @param {number} height - Image height in px
 * @param {object} ctx
 * @returns {Promise<Buffer>} PNG buffer ready for compositing
 */
async function buildWatermarkPng(width, height, ctx) {
  const opacity = getOpacity(ctx.userRole);
  const fontSize = Math.max(18, Math.round(Math.min(width, height) * 0.032));
  const timestamp = ctx.timestamp || new Date().toISOString().split('T')[0];

  const line1 = `${ctx.clubName} \u00b7 ${ctx.eventName}`;
  const line2 = `${ctx.userName} \u00b7 ${timestamp}`;

  // Render each line as a separate Sharp text image, then combine onto a
  // transparent canvas and rotate/position it.
  const alphaFull  = Math.round(opacity * 255);
  const alphaSmall = Math.round(opacity * 0.85 * 255);

  // Render line 1 (bold)
  const text1Buf = await sharp({
    text: {
      text: `<span foreground="white">${escapeXml(line1)}</span>`,
      font: 'Sans Bold',
      fontSize,
      rgba: true,
    },
  })
    .png()
    .toBuffer();

  const text1Meta = await sharp(text1Buf).metadata();
  const t1w = text1Meta.width || 1;
  const t1h = text1Meta.height || 1;

  // Render line 2 (regular, slightly smaller)
  const fontSize2 = Math.round(fontSize * 0.82);
  const text2Buf = await sharp({
    text: {
      text: `<span foreground="white">${escapeXml(line2)}</span>`,
      font: 'Sans',
      fontSize: fontSize2,
      rgba: true,
    },
  })
    .png()
    .toBuffer();

  const text2Meta = await sharp(text2Buf).metadata();
  const t2w = text2Meta.width || 1;
  const t2h = text2Meta.height || 1;

  const gap = Math.round(fontSize * 0.4);
  const blockW = Math.max(t1w, t2w);
  const blockH = t1h + gap + t2h;

  // Composite both lines onto a transparent canvas, centered
  const canvas = await sharp({
    create: {
      width: blockW,
      height: blockH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: await sharp(text1Buf).ensureAlpha().modulate({ brightness: 1 }).toBuffer(),
        left: Math.round((blockW - t1w) / 2),
        top: 0,
        blend: 'over',
      },
      {
        input: await sharp(text2Buf).ensureAlpha().toBuffer(),
        left: Math.round((blockW - t2w) / 2),
        top: t1h + gap,
        blend: 'over',
      },
    ])
    .png()
    .toBuffer();

  // Rotate -25° and place centered on a full-image transparent canvas
  const rotated = await sharp(canvas)
    .rotate(-25, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const rotMeta = await sharp(rotated).metadata();
  const rw = rotMeta.width || blockW;
  const rh = rotMeta.height || blockH;

  const overlay = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: rotated,
        left: Math.round((width - rw) / 2),
        top: Math.round((height - rh) / 2),
        blend: 'over',
      },
    ])
    // Apply the opacity by adjusting alpha channel
    .png()
    .toBuffer();

  return overlay;
}

/**
 * Apply a dynamic centered watermark to an image and return JPEG bytes.
 * The download is always served as a JPEG (.jpg) regardless of the source
 * format so users get a universally compatible file. Quality is high
 * enough that the additional encode is visually transparent for typical
 * photographs.
 *
 * @param {Buffer} inputBuffer - Raw image buffer (any format Sharp supports)
 * @param {object} ctx
 * @returns {Promise<{ buffer: Buffer, contentType: string, ext: string }>}
 */
export async function applyWatermark(inputBuffer, ctx) {
  const image = sharp(inputBuffer);
  const metadata = await image.metadata();
  const width  = metadata.width  || 1200;
  const height = metadata.height || 800;

  const timestamp = ctx.timestamp || new Date().toISOString().split('T')[0];
  const overlayBuffer = await buildWatermarkPng(width, height, { ...ctx, timestamp });

  const buffer = await image
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .composite([{ input: overlayBuffer, blend: 'over' }])
    .jpeg({ quality: 95, mozjpeg: true, chromaSubsampling: '4:4:4' })
    .toBuffer();

  return { buffer, contentType: 'image/jpeg', ext: 'jpg' };
}

import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';
import { tmpdir } from 'os';
import { writeFile, readFile, unlink } from 'fs/promises';
import crypto from 'crypto';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/**
 * Apply a diagonal repeated text watermark to a video using FFmpeg.
 *
 * Strategy: Generate a transparent PNG watermark overlay with the same diagonal
 * tiled watermark used for images (via Sharp + SVG), then use FFmpeg's overlay
 * filter with scale2ref to composite it onto every frame. This avoids the broken
 * drawtext `angle` parameter and produces consistent results with image watermarks.
 *
 * @param {Buffer} inputBuffer - Raw video buffer
 * @param {object} ctx
 * @param {string} ctx.clubName
 * @param {string} ctx.eventName
 * @param {string} ctx.userName
 * @param {string} ctx.userRole
 * @param {string} [ctx.timestamp]
 * @returns {Promise<Buffer>} Watermarked video buffer
 */
export async function applyVideoWatermark(inputBuffer, ctx) {
  const id = crypto.randomUUID();
  const inputPath   = join(tmpdir(), `wm-in-${id}.mp4`);
  const overlayPath = join(tmpdir(), `wm-overlay-${id}.png`);
  const outputPath  = join(tmpdir(), `wm-out-${id}.mp4`);

  const timestamp = ctx.timestamp || new Date().toISOString().split('T')[0];

  // Use a large reference size for the watermark overlay — FFmpeg's scale2ref
  // will resize it to match the actual video dimensions.
  const refWidth = 1920;
  const refHeight = 1080;

  try {
    // Write input video to temp file
    await writeFile(inputPath, inputBuffer);

    // Generate transparent PNG watermark overlay using the Pango text renderer
    const overlayBuffer = await buildWatermarkPng(refWidth, refHeight, { ...ctx, timestamp });
    await writeFile(overlayPath, overlayBuffer);

    // Use scale2ref to match overlay to video size, then overlay
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .input(overlayPath)
        .complexFilter([
          '[1:v][0:v]scale2ref=w=iw:h=ih[wm][vid]',
          '[vid][wm]overlay=0:0[outv]'
        ])
        .outputOptions([
          '-map', '[outv]',
          '-map', '0:a?',
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '23',
          '-c:a', 'copy',
          '-movflags', '+faststart',
        ])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    const outputBuffer = await readFile(outputPath);
    return outputBuffer;
  } finally {
    // Clean up temp files
    await unlink(inputPath).catch(() => {});
    await unlink(overlayPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

/**
 * Extract a thumbnail frame from a video at the 1-second mark.
 * Falls back to 0s if the video is shorter than 1s.
 * Returns a compressed WebP buffer suitable for use as a cover image.
 *
 * @param {Buffer} inputBuffer - Raw video buffer
 * @returns {Promise<Buffer>} WebP thumbnail buffer
 */
export async function extractVideoThumbnail(inputBuffer) {
  const id = crypto.randomUUID();
  const inputPath = join(tmpdir(), `thumb-in-${id}.mp4`);
  const outputPath = join(tmpdir(), `thumb-out-${id}.png`);

  try {
    await writeFile(inputPath, inputBuffer);

    // Try at 1s first, fall back to 0s if that fails
    const seekTimes = [1, 0];
    let succeeded = false;

    for (const seekTime of seekTimes) {
      try {
        await new Promise((resolve, reject) => {
          ffmpeg(inputPath)
            .seekInput(seekTime)
            .frames(1)
            .outputOptions(['-vf', 'scale=1280:-2'])
            .output(outputPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
        });
        succeeded = true;
        break;
      } catch (err) {
        console.error(`Thumbnail extraction at ${seekTime}s failed:`, err.message);
        // Try next seek time
      }
    }

    if (!succeeded) {
      throw new Error('Failed to extract thumbnail at any seek position');
    }

    // Read the screenshot and compress to WebP
    const pngBuffer = await readFile(outputPath);
    const webpBuffer = await sharp(pngBuffer)
      .webp({ quality: 80 })
      .toBuffer();

    return webpBuffer;
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}
