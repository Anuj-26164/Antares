import mongoose from 'mongoose';
import './config/env.js';

try {
  await mongoose.connect(process.env.MONGO_URI);
  
  const result = await mongoose.connection.db
    .collection('media')
    .updateMany(
      { url: { $regex: 'r2\\.dev/[0-9a-f]' } },
      [{ $set: { url: { $replaceOne: { input: '$url', find: 'r2.dev/', replacement: 'r2.dev/events-management-app/' } } } }]
    );

  console.log(`Fixed ${result.modifiedCount} media URLs`);
} catch (err) {
  console.error('Error:', err.message);
}

process.exit(0);
