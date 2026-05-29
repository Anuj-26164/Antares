/**
 * Migration script: Sync media isPublic with their parent event's isPublic.
 * 
 * Media in private events should be private.
 * Media in public events should be public.
 * 
 * Run: node scripts/syncMediaVisibility.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || process.env.DATABASE_URL;

if (!MONGO_URI) {
  console.error('MONGO_URI not set in .env');
  process.exit(1);
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const Event = mongoose.model('Event', new mongoose.Schema({
    isPublic: Boolean,
  }));

  const Media = mongoose.model('Media', new mongoose.Schema({
    eventId: mongoose.Schema.Types.ObjectId,
    isPublic: Boolean,
  }));

  // Find all private events
  const privateEvents = await Event.find({ isPublic: false }).select('_id').lean();
  const privateEventIds = privateEvents.map(e => e._id);

  if (privateEventIds.length === 0) {
    console.log('No private events found. Nothing to do.');
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${privateEventIds.length} private event(s)`);

  // Set all media in private events to isPublic: false
  const result = await Media.updateMany(
    { eventId: { $in: privateEventIds }, isPublic: true },
    { $set: { isPublic: false } }
  );

  console.log(`Updated ${result.modifiedCount} media item(s) to private`);

  // Also ensure media in public events is public (in case of any inconsistency)
  const publicEvents = await Event.find({ isPublic: true }).select('_id').lean();
  const publicEventIds = publicEvents.map(e => e._id);

  const result2 = await Media.updateMany(
    { eventId: { $in: publicEventIds }, isPublic: false },
    { $set: { isPublic: true } }
  );

  console.log(`Updated ${result2.modifiedCount} media item(s) to public`);

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
