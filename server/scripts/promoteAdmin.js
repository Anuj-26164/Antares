/**
 * promoteAdmin.js — Promote a registered user to admin role.
 *
 * Usage (from the server/ directory):
 *   node scripts/promoteAdmin.js <email>
 *
 * Example:
 *   node scripts/promoteAdmin.js john@example.com
 */

import mongoose from 'mongoose';
import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load .env from server/ regardless of where the script is invoked from
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '../.env') });

const email = process.argv[2] || 'test@test.com';

if (!email) {
  console.error('❌  Usage: node scripts/promoteAdmin.js <email>');
  process.exit(1);
}

if (!process.env.MONGO_URI) {
  console.error('❌  MONGO_URI not set. Check your server/.env file.');
  process.exit(1);
}

try {
  console.log(`\n🔑  Connecting to MongoDB…`);
  await mongoose.connect(process.env.MONGO_URI);
  console.log('   Connected.\n');

  const result = await mongoose.connection.db
    .collection('users')
    .updateOne({ email }, { $set: { role: 'admin' } });

  if (result.matchedCount === 0) {
    console.log(`❌  No user found with email "${email}".`);
    console.log('    Make sure the user has registered first.\n');
  } else if (result.modifiedCount === 0) {
    console.log(`ℹ️   "${email}" is already an admin. No changes made.\n`);
  } else {
    console.log(`✅  "${email}" has been promoted to admin.`);
    console.log('    They can now access /admin after logging in.\n');
  }
} catch (err) {
  console.error('❌  Error:', err.message);
  process.exit(1);
} finally {
  await mongoose.disconnect();
}
