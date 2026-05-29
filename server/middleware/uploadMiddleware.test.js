/**
 * Unit tests for uploadMiddleware.
 * Tests the file filter, size validation, and magic byte validation logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Top-level mocks (hoisted by Vitest before any imports) ──────────────────

vi.mock('../config/r2.js', () => ({
  default: {},
  R2_BUCKET_NAME: 'test-bucket',
}));

vi.mock('multer-s3', () => ({
  default: vi.fn(() => ({})),
  AUTO_CONTENT_TYPE: vi.fn(),
}));

/**
 * The multer mock captures the fileFilter and limits from the first multer()
 * call. Since vi.mock factories are hoisted above all variable declarations,
 * we store the captured values on the mock function itself (accessible after
 * the import runs).
 */
vi.mock('multer', () => {
  const mockMulterInstance = {
    single: vi.fn(() => (req, res, next) => next()),
    array: vi.fn(() => (req, res, next) => next()),
  };

  const multerFn = vi.fn((config) => {
    // Store captured config on the mock function itself
    if (!multerFn._capturedFileFilter && config && config.fileFilter) {
      multerFn._capturedFileFilter = config.fileFilter;
      multerFn._capturedLimits = config.limits;
    }
    return mockMulterInstance;
  });

  multerFn.memoryStorage = vi.fn(() => ({}));
  return { default: multerFn };
});

// Import the module AFTER mocks are set up
import multer from 'multer';
import {
  uploadSingle,
  uploadBulk,
  detectMimeFromBuffer,
  isAllowedMime,
  isAllowedImageMime,
} from './uploadMiddleware.js';

// ── Tests ───────────────────────────────────────────────────────────────────

describe('uploadMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fileFilter (MIME type gate)', () => {
    it('accepts JPEG files', () => {
      const cb = vi.fn();
      multer._capturedFileFilter({}, { mimetype: 'image/jpeg' }, cb);
      expect(cb).toHaveBeenCalledWith(null, true);
    });

    it('accepts PNG files', () => {
      const cb = vi.fn();
      multer._capturedFileFilter({}, { mimetype: 'image/png' }, cb);
      expect(cb).toHaveBeenCalledWith(null, true);
    });

    it('accepts WebP files', () => {
      const cb = vi.fn();
      multer._capturedFileFilter({}, { mimetype: 'image/webp' }, cb);
      expect(cb).toHaveBeenCalledWith(null, true);
    });

    it('accepts GIF files', () => {
      const cb = vi.fn();
      multer._capturedFileFilter({}, { mimetype: 'image/gif' }, cb);
      expect(cb).toHaveBeenCalledWith(null, true);
    });

    it('accepts MP4 files', () => {
      const cb = vi.fn();
      multer._capturedFileFilter({}, { mimetype: 'video/mp4' }, cb);
      expect(cb).toHaveBeenCalledWith(null, true);
    });

    it('accepts MOV files', () => {
      const cb = vi.fn();
      multer._capturedFileFilter({}, { mimetype: 'video/quicktime' }, cb);
      expect(cb).toHaveBeenCalledWith(null, true);
    });

    it('accepts WebM files', () => {
      const cb = vi.fn();
      multer._capturedFileFilter({}, { mimetype: 'video/webm' }, cb);
      expect(cb).toHaveBeenCalledWith(null, true);
    });

    it('rejects unsupported file types with error', () => {
      const cb = vi.fn();
      multer._capturedFileFilter({}, { mimetype: 'application/pdf' }, cb);
      expect(cb).toHaveBeenCalledWith(expect.any(Error), false);
      const error = cb.mock.calls[0][0];
      expect(error.statusCode).toBe(400);
      expect(error.message).toContain('Unsupported file format');
    });

    it('rejects BMP files', () => {
      const cb = vi.fn();
      multer._capturedFileFilter({}, { mimetype: 'image/bmp' }, cb);
      expect(cb).toHaveBeenCalledWith(expect.any(Error), false);
    });

    it('rejects AVI files', () => {
      const cb = vi.fn();
      multer._capturedFileFilter({}, { mimetype: 'video/x-msvideo' }, cb);
      expect(cb).toHaveBeenCalledWith(expect.any(Error), false);
    });
  });

  describe('size limits', () => {
    it('sets multer fileSize limit to 500 MB (video max)', () => {
      expect(multer._capturedLimits.fileSize).toBe(500 * 1024 * 1024);
    });
  });

  describe('validateFileSize (via uploadSingle/uploadBulk)', () => {
    it('exports uploadSingle as an array of 2 middleware functions', () => {
      expect(Array.isArray(uploadSingle)).toBe(true);
      expect(uploadSingle).toHaveLength(2);
    });

    it('exports uploadBulk as an array of 2 middleware functions', () => {
      expect(Array.isArray(uploadBulk)).toBe(true);
      expect(uploadBulk).toHaveLength(2);
    });

    it('passes when image file is under 25 MB', () => {
      const validateFileSize = uploadSingle[1];
      const req = { file: { mimetype: 'image/jpeg', size: 10 * 1024 * 1024, originalname: 'photo.jpg' } };
      const next = vi.fn();
      validateFileSize(req, {}, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('rejects image file over 25 MB', () => {
      const validateFileSize = uploadSingle[1];
      const req = { file: { mimetype: 'image/png', size: 26 * 1024 * 1024, originalname: 'big.png' } };
      const next = vi.fn();
      validateFileSize(req, {}, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(400);
      expect(error.message).toContain('25 MB');
    });

    it('passes when video file is under 500 MB', () => {
      const validateFileSize = uploadSingle[1];
      const req = { file: { mimetype: 'video/mp4', size: 200 * 1024 * 1024, originalname: 'clip.mp4' } };
      const next = vi.fn();
      validateFileSize(req, {}, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('rejects video file over 500 MB', () => {
      const validateFileSize = uploadSingle[1];
      const req = { file: { mimetype: 'video/mp4', size: 501 * 1024 * 1024, originalname: 'huge.mp4' } };
      const next = vi.fn();
      validateFileSize(req, {}, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(400);
      expect(error.message).toContain('500 MB');
    });

    it('validates multiple files in bulk upload', () => {
      const validateFileSize = uploadBulk[1];
      const req = {
        files: [
          { mimetype: 'image/jpeg', size: 5 * 1024 * 1024, originalname: 'a.jpg' },
          { mimetype: 'video/mp4', size: 100 * 1024 * 1024, originalname: 'b.mp4' },
        ],
      };
      const next = vi.fn();
      validateFileSize(req, {}, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('rejects bulk upload if any image exceeds limit', () => {
      const validateFileSize = uploadBulk[1];
      const req = {
        files: [
          { mimetype: 'image/jpeg', size: 5 * 1024 * 1024, originalname: 'ok.jpg' },
          { mimetype: 'image/png', size: 30 * 1024 * 1024, originalname: 'toobig.png' },
        ],
      };
      const next = vi.fn();
      validateFileSize(req, {}, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const error = next.mock.calls[0][0];
      expect(error.message).toContain('toobig.png');
    });

    it('passes when no files are present', () => {
      const validateFileSize = uploadSingle[1];
      const req = {};
      const next = vi.fn();
      validateFileSize(req, {}, next);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('detectMimeFromBuffer and isAllowedMime (magic byte validation)', () => {
    it('detects JPEG from magic bytes (FF D8 FF)', () => {
      const buf = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
      expect(detectMimeFromBuffer(buf)).toBe('image/jpeg');
    });

    it('detects PNG from magic bytes (89 50 4E 47)', () => {
      const buf = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
      expect(detectMimeFromBuffer(buf)).toBe('image/png');
    });

    it('detects GIF from magic bytes (47 49 46)', () => {
      const buf = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00]);
      expect(detectMimeFromBuffer(buf)).toBe('image/gif');
    });

    it('returns null for a buffer that is too short', () => {
      expect(detectMimeFromBuffer(Buffer.from([0xFF, 0xD8]))).toBeNull();
    });

    it('returns null for an unrecognised buffer', () => {
      const buf = Buffer.alloc(20, 0x00);
      expect(detectMimeFromBuffer(buf)).toBeNull();
    });

    it('isAllowedMime returns true for image/jpeg', () => {
      expect(isAllowedMime('image/jpeg')).toBe(true);
    });

    it('isAllowedMime returns true for video/mp4', () => {
      expect(isAllowedMime('video/mp4')).toBe(true);
    });

    it('isAllowedMime returns false for application/pdf', () => {
      expect(isAllowedMime('application/pdf')).toBe(false);
    });

    it('isAllowedMime returns false for null', () => {
      expect(isAllowedMime(null)).toBe(false);
    });

    it('isAllowedImageMime returns true for image/png', () => {
      expect(isAllowedImageMime('image/png')).toBe(true);
    });

    it('isAllowedImageMime returns false for video/mp4', () => {
      expect(isAllowedImageMime('video/mp4')).toBe(false);
    });

    it('rejects a disguised file: PDF bytes with image/jpeg MIME', () => {
      // PDF magic bytes: 25 50 44 46
      const pdfBytes = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x0A, 0x25, 0xE2, 0xE3]);
      const detected = detectMimeFromBuffer(pdfBytes);
      // file-type v3.9.0 detects this as application/pdf — not in allowed list
      expect(isAllowedMime(detected)).toBe(false);
    });
  });
});
