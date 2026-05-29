/**
 * Migration Script: Remove Duplicate Cover Image Media Records
 *
 * This script finds Media records whose URL matches an Event's coverImage URL
 * and deletes them. It does NOT delete the underlying R2 objects since the
 * Event model still references them via the coverImage field.
 *
 * Usage: node server/scripts/migrateCoverMedia.js
 * (Run from the project root, or from server/ with: node scripts/migrateCoverMedia.js)
 */

import 'dotenv/config';
import mongoose from 'mongoose';

// Import models
import Event from '../models/Event.js';
import Media from '../models/Media.js';

async function main() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    console.error('ERROR: MONGO_URI environment variable is not set.');
    process.exit(1);
  }

  try {
    // Connect to MongoDB
    const conn = await mongoose.connect(mongoUri);
    console.log(`MongoDB connected: ${conn.connection.host}`);

    // Find all events with a non-empty coverImage field
    const events = await Event.find({
      coverImage: { $exists: true, $ne: '' },
    }).lean();

    console.log(`Found ${events.length} events with cover images.`);

    let removedCount = 0;

    for (const event of events) {
      // Find Media records whose url matches this event's coverImage
      const duplicates = await Media.find({ url: event.coverImage });

      if (duplicates.length > 0) {
        // Delete the duplicate Media records only (NOT the R2 objects)
        const result = await Media.deleteMany({
          _id: { $in: duplicates.map((d) => d._id) },
        });

        removedCount += result.deletedCount;
        console.log(
          `  Event "${event.title}" (${event._id}): removed ${result.deletedCount} duplicate Media record(s)`
        );
      }
    }

    console.log(
      `\nMigration complete: removed ${removedCount} duplicate Media records.`
    );
  } catch (error) {
    console.error(`Migration failed: ${error.message}`);
    process.exit(1);
  } finally {
    // Graceful disconnect
    await mongoose.disconnect();
    console.log('MongoDB disconnected.');
  }
}

main();
