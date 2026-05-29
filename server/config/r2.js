/**
 * Cloudflare R2 S3 client configuration.
 * Uses the S3-compatible API via @aws-sdk/client-s3.
 */

import { S3Client } from '@aws-sdk/client-s3';
import config from './env.js';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: config.R2_ENDPOINT,
  credentials: {
    accessKeyId: config.R2_ACCESS_KEY_ID,
    secretAccessKey: config.R2_SECRET_ACCESS_KEY,
  },
});

export const R2_BUCKET_NAME = config.R2_BUCKET_NAME;
export default r2Client;
