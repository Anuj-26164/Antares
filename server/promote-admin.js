import mongoose from 'mongoose';
import './config/env.js';

const email = process.argv[2] || 'test@test.com';

try {
  await mongoose.connect(process.env.MONGO_URI);
  const result = await mongoose.connection.db
    .collection('users')
    .updateOne({ email }, { $set: { role: 'admin' } });

  if (result.modifiedCount > 0) {
    console.log(`✓ User "${email}" promoted to admin`);
  } else {
    console.log(`✗ No user found with email "${email}"`);
  }
} catch (err) {
  console.error('Error:', err.message);
}

process.exit(0);
