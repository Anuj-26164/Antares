import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Bundled fonts — loaded once at module init and embedded into every watermark
// SVG as base64 data URIs so that librsvg renders proper glyphs on Railway
// (and any Linux env) even when no system font packages are installed.
// ---------------------------------------------------------------------------
function loadFont(filename) {
  try {
    const buf = readFileSync(join(__dirname, '..', 'assets', filename));
    return buf.toString('base64');
  } catch {
    return null; // graceful — fall back to system fonts if file is missing
  }
}

const FONT_REGULAR_B64 = loadFont('Roboto-Regular.woff');
const FONT_BOLD_B64    = loadFont('Roboto-Bold.woff');

/**
 * Return an SVG <defs> block that declares @font-face rules using the bundled
 * woff files embedded as base64 data URIs. If the font files are not present
 * (e.g. local dev without assets/) this returns an empty string so we still
 * fall back to whatever system fonts are available.
 */
function fontFaceDefs() {
  if (!FONT_REGULAR_B64 && !FONT_BOLD_B64) return '';
  const rules = [];
  if (FONT_REGULAR_B64) {
    rules.push(
      `@font-face { font-family: 'BundledFont'; font-weight: normal; ` +
      `src: url('data:font/woff;base64,${FONT_REGULAR_B64}') format('woff'); }`,
    );
  }
  if (FONT_BOLD_B64) {
    rules.push(
      `@font-face { font-family: 'BundledFont'; font-weight: bold; ` +
      `src: url('data:font/woff;base64,${FONT_BOLD_B64}') format('woff'); }`,
    );
  }
  return `<defs><style>${rules.join(' ')}</style></defs>`;
}

// The font-family value to use inside SVG font-family attributes.
// When bundled fonts are available, 'BundledFont' resolves to our woff files.
const SVG_FONT_FAMILY = FONT_REGULAR_B64
  ? 'BundledFont, Arial, Helvetica, Liberation Sans, sans-serif'
  : 'Arial, Helvetica, Liberation Sans, sans-serif';

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
 * Build a centered diagonal watermark overlay as an SVG buffer, composited
 * via Sharp's librsvg pipeline. This approach requires NO system fonts —
 * librsvg is bundled with the Sharp npm package and works on Railway (and any
 * other Linux environment) without extra apt packages.
 *
 * Previously this used Sharp's Pango text renderer which silently falls back
 * to tofu (block squares) on Railway because the container has no installed
 * font packages. SVG text with generic font-family names is handled entirely
 * by librsvg's built-in font stack.
 *
 * @param {number} width  - Image width in px
 * @param {number} height - Image height in px
 * @param {object} ctx
 * @returns {Promise<Buffer>} PNG buffer ready for compositing
 */
async function buildWatermarkPng(width, height, ctx) {
  const opacity = getOpacity(ctx.userRole);
  const fontSize = Math.max(18, Math.round(Math.min(width, height) * 0.032));
  const fontSize2 = Math.round(fontSize * 0.82);
  const timestamp = ctx.timestamp || new Date().toISOString().split('T')[0];

  const line1 = escapeXml(`${ctx.clubName} \u00b7 ${ctx.eventName}`);
  const line2 = escapeXml(`${ctx.userName} \u00b7 ${timestamp}`);

  // Estimate text block dimensions (SVG units ≈ px for our font sizes).
  // We over-estimate the width so the text never gets clipped.
  const charW1 = fontSize * 0.6;
  const charW2 = fontSize2 * 0.6;
  const maxChars = Math.max(line1.length, line2.length);
  const estW = Math.round(Math.max(charW1, charW2) * maxChars * 1.1);
  const lineGap = Math.round(fontSize * 0.4);
  const estH = fontSize + lineGap + fontSize2 + Math.round(fontSize * 0.3);

  // Build the text block as SVG with @font-face embedding our bundled woff
  // fonts as base64 data URIs. This makes rendering self-contained so
  // librsvg doesn't need any system font packages (critical on Railway).
  const svgText = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${estW}" height="${estH}">
      ${fontFaceDefs()}
      <text
        x="${estW / 2}" y="${fontSize}"
        font-family="${SVG_FONT_FAMILY}"
        font-size="${fontSize}"
        font-weight="bold"
        fill="white"
        fill-opacity="${opacity}"
        text-anchor="middle"
        dominant-baseline="auto"
      >${line1}</text>
      <text
        x="${estW / 2}" y="${fontSize + lineGap + fontSize2}"
        font-family="${SVG_FONT_FAMILY}"
        font-size="${fontSize2}"
        font-weight="normal"
        fill="white"
        fill-opacity="${opacity * 0.85}"
        text-anchor="middle"
        dominant-baseline="auto"
      >${line2}</text>
    </svg>`
  );

  // Rasterise the SVG text block to a PNG via Sharp.
  const textBlockPng = await sharp(svgText)
    .png()
    .toBuffer();

  const textMeta = await sharp(textBlockPng).metadata();
  const bw = textMeta.width  || estW;
  const bh = textMeta.height || estH;

  // Rotate the text block -25° on a transparent canvas.
  const rotated = await sharp(textBlockPng)
    .rotate(-25, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const rotMeta = await sharp(rotated).metadata();
  const rw = rotMeta.width  || bw;
  const rh = rotMeta.height || bh;

  // Place the rotated block centred on a full-image transparent canvas.
  const overlay = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{
      input: rotated,
      left: Math.max(0, Math.round((width  - rw) / 2)),
      top:  Math.max(0, Math.round((height - rh) / 2)),
      blend: 'over',
    }])
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
