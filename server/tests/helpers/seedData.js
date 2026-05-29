/**
 * Seed data script for integration/smoke tests.
 * Run: node server/tests/helpers/seedData.js
 *
 * Creates: admin, photographer, viewer users + 1 event + 2 media items.
 * Requires a running MongoDB (uses TEST_MONGO_URI or MONGO_URI from .env).
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGO_URI = process.env.TEST_MONGO_URI || process.env.MONGO_URI;

async function seed() {
  if (!MONGO_URI) {
    console.error('No MONGO_URI set. Skipping seed.');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  // Dynamic imports after connection
  const { default: User }  = await import('../../models/User.js');
  const { default: Event } = await import('../../models/Event.js');
  const { default: Media } = await import('../../models/Media.js');

  // Clean up existing seed users
  await User.deleteMany({ email: { $in: ['admin@antares.test', 'photo@antares.test', 'viewer@antares.test'] } });

  const hash = (pw) => bcrypt.hash(pw, 12);

  const [admin, photographer, viewer] = await Promise.all([
    User.create({ name: 'Seed Admin',        email: 'admin@antares.test',  password: await hash('Admin1234!'),  role: 'admin' }),
    User.create({ name: 'Seed Photographer', email: 'photo@antares.test',  password: await hash('Photo1234!'),  role: 'photographer' }),
    User.create({ name: 'Seed Viewer',       email: 'viewer@antares.test', password: await hash('Viewer1234!'), role: 'viewer' }),
  ]);

  console.log('Created users:', admin._id, photographer._id, viewer._id);

  // Clean up existing seed events
  await Event.deleteMany({ title: 'Seed Event 2025' });

  const event = await Event.create({
    title: 'Seed Event 2025',
    description: 'Auto-seeded test event',
    category: 'Workshop',
    date: new Date('2025-08-01'),
    createdBy: admin._id,
    isPublic: true,
    tags: ['seed', 'test'],
  });

  console.log('Created event:', event._id);

  // Clean up existing seed media
  await Media.deleteMany({ r2Key: { $in: ['seed/photo.webp', 'seed/video.mp4'] } });

  const [photo, video] = await Promise.all([
    Media.create({
      eventId: event._id,
      uploadedBy: photographer._id,
      url: 'https://cdn.example.com/seed/photo.webp',
      r2Key: 'seed/photo.webp',
      type: 'photo',
      isPublic: true,
    }),
    Media.create({
      eventId: event._id,
      uploadedBy: photographer._id,
      url: 'https://cdn.example.com/seed/video.mp4',
      r2Key: 'seed/video.mp4',
      type: 'video',
      isPublic: true,
    }),
  ]);

  console.log('Created media:', photo._id, video._id);
  console.log('\nSeed complete. Credentials:');
  console.log('  admin@antares.test     / Admin1234!');
  console.log('  photo@antares.test     / Photo1234!');
  console.log('  viewer@antares.test    / Viewer1234!');

  await mongoose.disconnect();
}

seed().catch((err) => { console.error(err); process.exit(1); });
