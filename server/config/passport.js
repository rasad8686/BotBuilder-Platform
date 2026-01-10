/**
 * Passport OAuth Configuration
 * Google and Microsoft OAuth2 strategies
 */
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const MicrosoftStrategy = require('passport-microsoft').Strategy;
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');
const log = require('../utils/logger');

/**
 * Initialize Passport with OAuth strategies
 */
function initializePassport() {
  // Serialize user for session
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id, done) => {
    try {
      const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
      done(null, result.rows[0] || null);
    } catch (err) {
      done(err, null);
    }
  });

  // Google OAuth Strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
      scope: ['profile', 'email']
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const name = profile.displayName || profile.name?.givenName || 'User';
        const googleId = profile.id;

        if (!email) {
          return done(new Error('No email provided by Google'), null);
        }

        // Check if user exists by email or Google ID
        let result = await db.query(
          'SELECT * FROM users WHERE email = $1 OR google_id = $2',
          [email, googleId]
        );

        let user = result.rows[0];

        log.info('Google OAuth lookup', { email, googleId, userFound: !!user });

        if (user) {
          // Update Google ID if not set
          if (!user.google_id) {
            await db.query(
              'UPDATE users SET google_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
              [googleId, user.id]
            );
          }
          // Update email_verified if not verified
          if (!user.email_verified) {
            await db.query(
              'UPDATE users SET email_verified = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
              [user.id]
            );
          }

          // Get user's organization if not set
          if (!user.current_organization_id) {
            const orgResult = await db.query(
              `SELECT org_id FROM organization_members WHERE user_id = $1 AND status = 'active' LIMIT 1`,
              [user.id]
            );
            if (orgResult.rows[0]) {
              user.current_organization_id = orgResult.rows[0].org_id;
            }
          }

          log.info('Google OAuth login', { userId: user.id, email, orgId: user.current_organization_id });
        } else {
          // Create new user with random password hash (OAuth users don't use password)
          const randomPassword = crypto.randomBytes(32).toString('hex');
          const passwordHash = await bcrypt.hash(randomPassword, 10);

          const insertResult = await db.query(
            `INSERT INTO users (name, email, google_id, password_hash, email_verified, created_at, updated_at)
             VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             RETURNING *`,
            [name, email, googleId, passwordHash]
          );
          user = insertResult.rows[0];

          // Create default organization for new user
          const orgResult = await db.query(
            `INSERT INTO organizations (name, slug, owner_id, plan_tier, settings, created_at, updated_at)
             VALUES ($1, $2, $3, 'free', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             RETURNING id`,
            [`${name}'s Workspace`, `workspace-${user.id}`, user.id]
          );

          // Add user to organization
          await db.query(
            `INSERT INTO organization_members (org_id, user_id, role, status, joined_at)
             VALUES ($1, $2, 'admin', 'active', CURRENT_TIMESTAMP)`,
            [orgResult.rows[0].id, user.id]
          );

          // Update user with organization
          await db.query(
            'UPDATE users SET current_organization_id = $1 WHERE id = $2',
            [orgResult.rows[0].id, user.id]
          );
          user.current_organization_id = orgResult.rows[0].id;

          log.info('Google OAuth new user created', { userId: user.id, email });
        }

        return done(null, user);
      } catch (err) {
        log.error('Google OAuth error', { error: err.message });
        return done(err, null);
      }
    }));

    log.info('Google OAuth strategy initialized');
  } else {
    log.warn('Google OAuth not configured - GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET required');
  }

  // Microsoft OAuth Strategy
  if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
    passport.use(new MicrosoftStrategy({
      clientID: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      callbackURL: process.env.MICROSOFT_CALLBACK_URL || '/api/auth/microsoft/callback',
      scope: ['user.read']
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value || profile._json?.mail || profile._json?.userPrincipalName;
        const name = profile.displayName || profile.name?.givenName || 'User';
        const microsoftId = profile.id;

        if (!email) {
          return done(new Error('No email provided by Microsoft'), null);
        }

        // Check if user exists by email or Microsoft ID
        let result = await db.query(
          'SELECT * FROM users WHERE email = $1 OR microsoft_id = $2',
          [email, microsoftId]
        );

        let user = result.rows[0];

        if (user) {
          // Update Microsoft ID if not set
          if (!user.microsoft_id) {
            await db.query(
              'UPDATE users SET microsoft_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
              [microsoftId, user.id]
            );
          }
          // Update email_verified if not verified
          if (!user.email_verified) {
            await db.query(
              'UPDATE users SET email_verified = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
              [user.id]
            );
          }
          log.info('Microsoft OAuth login', { userId: user.id, email });
        } else {
          // Create new user with random password hash (OAuth users don't use password)
          const randomPassword = crypto.randomBytes(32).toString('hex');
          const passwordHash = await bcrypt.hash(randomPassword, 10);

          const insertResult = await db.query(
            `INSERT INTO users (name, email, microsoft_id, password_hash, email_verified, created_at, updated_at)
             VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             RETURNING *`,
            [name, email, microsoftId, passwordHash]
          );
          user = insertResult.rows[0];

          // Create default organization for new user
          const orgResult = await db.query(
            `INSERT INTO organizations (name, slug, owner_id, plan_tier, settings, created_at, updated_at)
             VALUES ($1, $2, $3, 'free', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             RETURNING id`,
            [`${name}'s Workspace`, `workspace-${user.id}`, user.id]
          );

          // Add user to organization
          await db.query(
            `INSERT INTO organization_members (org_id, user_id, role, status, joined_at)
             VALUES ($1, $2, 'admin', 'active', CURRENT_TIMESTAMP)`,
            [orgResult.rows[0].id, user.id]
          );

          // Update user with organization
          await db.query(
            'UPDATE users SET current_organization_id = $1 WHERE id = $2',
            [orgResult.rows[0].id, user.id]
          );
          user.current_organization_id = orgResult.rows[0].id;

          log.info('Microsoft OAuth new user created', { userId: user.id, email });
        }

        return done(null, user);
      } catch (err) {
        log.error('Microsoft OAuth error', { error: err.message });
        return done(err, null);
      }
    }));

    log.info('Microsoft OAuth strategy initialized');
  } else {
    log.warn('Microsoft OAuth not configured - MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET required');
  }

  return passport;
}

module.exports = { initializePassport, passport };
