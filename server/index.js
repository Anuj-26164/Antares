import express from 'express';
import http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';

import { validateEnv } from './config/env.js';
import { connectDB } from './config/db.js';
import configurePassport from './config/passport.js';
import authRoutes from './routes/authRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import mediaRoutes from './routes/mediaRoutes.js';
import userRoutes from './routes/userRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import errorHandler from './middleware/errorHandler.js';
import { initSocketServer } from './sockets/index.js';

// Validate environment variables first
const config = validateEnv();

// Connect to MongoDB
await connectDB();

const app = express();

// Trust the reverse proxy (Render, Railway, etc.) so express-rate-limit
// can correctly identify client IPs from the X-Forwarded-For header.
app.set('trust proxy', 1);

// Initialize Passport
configurePassport(passport);
app.use(passport.initialize());

// CORS
app.use(cors({
  origin: config.CLIENT_URL,
  credentials: true,
}));

// Cookie parser
app.use(cookieParser());

// JSON body parser
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

// Error handler (must be last)
app.use(errorHandler);

// Create HTTP server from Express app
const httpServer = http.createServer(app);

// Attach Socket.IO — wrapped in try/catch so REST continues if socket init fails
try {
  initSocketServer(httpServer, config);
} catch (err) {
  console.error('Socket.IO initialization failed — REST API will continue without realtime:', err.message);
}

// Start server
httpServer.listen(config.PORT, () => {
  console.log(`Server running on port ${config.PORT}`);
});

export default app;
