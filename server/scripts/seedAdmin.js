/**
 * seedAdmin.js — Creates a default admin account for demo/testing.
 *
 * Creates test@test.com / test123 with role: admin.
 * Safe to re-run — skips creation if the email already exists.
 *
 * Usage (from the server/ directory):
 *   node scripts/seedAdmin.js
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '../.env') });

if (!process.env.MONGO_URI) {
  console.error('❌  MONGO_URI not set. Check your server/.env file.');
  process.exit(1);
}

const ADMIN_EMAIL    = 'test@test.com';
const ADMIN_PASSWORD = 'test123';
const ADMIN_NAME     = 'Admin';

await mongoose.connect(process.env.MONGO_URI);

const db = mongoose.connection.db;
const existing = await db.collection('users').findOne({ email: ADMIN_EMAIL });

if (existing) {
  // Already exists — just make sure the role is admin
  await db.collection('users').updateOne(
    { email: ADMIN_EMAIL },
    { $set: { role: 'admin' } }
  );
  console.log(`ℹ️   "${ADMIN_EMAIL}" already exists — role set to admin.`);
} else {
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await db.collection('users').insertOne({
    name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    password: hashedPassword,
    role: 'admin',
    isBlocked: false,
    createdAt: new Date(),
  });
  console.log(`✅  Admin account created: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

await mongoose.disconnect();
