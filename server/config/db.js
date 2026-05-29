import mongoose from 'mongoose';
import config from './env.js';

/**
 * Connects to MongoDB using the MONGO_URI from validated environment config.
 * Logs success on connection or logs the error and exits the process on failure.
 */
export async function connectDB() {
  try {
    const conn = await mongoose.connect(config.MONGO_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
}
