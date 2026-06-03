/**
 * Environment variable validation module.
 * Reads all required env vars, logs any missing ones, and exits
 * before any DB or service connections are established.
 */

import 'dotenv/config';

const REQUIRED_ENV_VARS = [
  'MONGO_URI',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_CALLBACK_URL',
  'CLIENT_URL',
  'R2_ENDPOINT',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL',
  // SERVER_URL is optional — defaults to http://localhost:<PORT> for local dev.
  // Set it to your Railway deployment URL in production.
];

/**
 * Validates that all required environment variables are present.
 * Logs each missing variable by name and terminates the process
 * with exit code 1 if any are missing.
 *
 * @returns {object} Validated config object with all env values.
 */
export function validateEnv() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error('ERROR: Missing required environment variables:');
    missing.forEach((key) => {
      console.error(`  - ${key}`);
    });
    process.exit(1);
  }

  const port = process.env.PORT || 5000;
  // SERVER_URL must be set to the Railway public URL in production
  // (e.g. https://your-app.up.railway.app). Falls back to localhost for dev.
  const serverUrl = (process.env.SERVER_URL || `http://localhost:${port}`).replace(/\/$/, '');

  return Object.freeze({
    PORT: port,
    SERVER_URL: serverUrl,
    MONGO_URI: process.env.MONGO_URI,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL,
    CLIENT_URL: process.env.CLIENT_URL,
    R2_ENDPOINT: process.env.R2_ENDPOINT,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
    R2_PUBLIC_URL: process.env.R2_PUBLIC_URL,
  });
}

/** Validated config — import this from other modules. */
const config = validateEnv();
export default config;
