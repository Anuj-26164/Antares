/**
 * Google OAuth 2.0 Passport strategy configuration.
 * Configures passport-google-oauth20 with verify callback that
 * finds or creates users by googleId or matching email.
 */

import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import config from './env.js';
import User from '../models/User.js';

/**
 * Configures the given passport instance with Google OAuth strategy
 * and user serialization/deserialization.
 *
 * @param {import('passport')} passport - The passport instance to configure.
 */
export default function configurePassport(passport) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.GOOGLE_CLIENT_ID,
        clientSecret: config.GOOGLE_CLIENT_SECRET,
        callbackURL: config.GOOGLE_CALLBACK_URL,
        scope: ['profile', 'email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          const emailVerified = profile.emails?.[0]?.verified;

          // Reject unverified emails
          if (!emailVerified) {
            return done(null, false, {
              message: 'A verified email is required for Google authentication.',
            });
          }

          // Try to find user by googleId first
          let user = await User.findOne({ googleId: profile.id });

          if (user) {
            return done(null, user);
          }

          // Try to find user by matching email (existing email-based account)
          user = await User.findOne({ email });

          if (user) {
            // Store googleId on existing email-based account
            user.googleId = profile.id;
            if (!user.avatar && profile.photos?.[0]?.value) {
              user.avatar = profile.photos[0].value;
            }
            await user.save();
            return done(null, user);
          }

          // Create new user from Google profile
          user = await User.create({
            name: profile.displayName,
            email,
            googleId: profile.id,
            avatar: profile.photos?.[0]?.value || '',
          });

          return done(null, user);
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );

  // Serialize user by _id for session storage
  passport.serializeUser((user, done) => {
    done(null, user._id);
  });

  // Deserialize user by _id from session storage
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
}
