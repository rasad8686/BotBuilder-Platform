/**
 * Create Superadmin Script
 *
 * Creates the initial superadmin user for the platform.
 * Usage: node scripts/create-superadmin.js
 *
 * Default credentials:
 * Email: super@botbuilder.com
 * Password: Super2025!
 *
 * Can be overridden with environment variables:
 * SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD, SUPERADMIN_NAME
 */

require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../db');

const defaultEmail = 'super@botbuilder.com';
const defaultPassword = 'Super2025!';
const defaultName = 'Super Admin';

async function createSuperadmin() {
  const email = process.env.SUPERADMIN_EMAIL || defaultEmail;
  const password = process.env.SUPERADMIN_PASSWORD || defaultPassword;
  const name = process.env.SUPERADMIN_NAME || defaultName;

  console.log('='.repeat(60));
  console.log('SUPERADMIN CREATION SCRIPT');
  console.log('='.repeat(60));

  try {
    // Check if superadmin column exists
    const columnCheck = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'is_superadmin'
    `);

    if (columnCheck.rows.length === 0) {
      console.log('\n[ERROR] is_superadmin column does not exist!');
      console.log('Please run migration 033_add_superadmin.sql first.');
      process.exit(1);
    }

    // Check if superadmin already exists
    const existingSuper = await db.query(
      'SELECT id, email, name FROM users WHERE is_superadmin = true'
    );

    if (existingSuper.rows.length > 0) {
      console.log('\n[INFO] Superadmin(s) already exist:');
      existingSuper.rows.forEach(user => {
        console.log(`  - ${user.email} (ID: ${user.id}, Name: ${user.name})`);
      });

      // Check if specific email exists
      const specificUser = await db.query(
        'SELECT id, email, is_superadmin FROM users WHERE email = $1',
        [email]
      );

      if (specificUser.rows.length > 0) {
        if (specificUser.rows[0].is_superadmin) {
          console.log(`\n[SKIP] User ${email} is already a superadmin.`);
        } else {
          // Upgrade existing user to superadmin
          await db.query(
            'UPDATE users SET is_superadmin = true WHERE email = $1',
            [email]
          );
          console.log(`\n[SUCCESS] User ${email} upgraded to superadmin!`);
        }
        process.exit(0);
      }
    }

    // Check if user with email exists but is not superadmin
    const existingUser = await db.query(
      'SELECT id, email, is_superadmin FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      // Upgrade to superadmin
      await db.query(
        'UPDATE users SET is_superadmin = true WHERE email = $1',
        [email]
      );
      console.log(`\n[SUCCESS] Existing user ${email} upgraded to superadmin!`);
      process.exit(0);
    }

    // Create new superadmin user
    console.log('\n[INFO] Creating new superadmin user...');
    console.log(`  Email: ${email}`);
    console.log(`  Name: ${name}`);

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await db.query(
      `INSERT INTO users (name, email, password_hash, email_verified, is_superadmin, created_at, updated_at)
       VALUES ($1, $2, $3, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, name, email`,
      [name, email, hashedPassword]
    );

    const newUser = result.rows[0];
    console.log(`\n[SUCCESS] Superadmin created!`);
    console.log(`  ID: ${newUser.id}`);
    console.log(`  Email: ${newUser.email}`);
    console.log(`  Name: ${newUser.name}`);

    // Create personal organization for superadmin
    console.log('\n[INFO] Creating personal organization...');

    const orgResult = await db.query(
      `INSERT INTO organizations (name, slug, owner_id, plan_tier, settings, created_at, updated_at)
       VALUES ($1, $2, $3, 'enterprise', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, name, slug`,
      [`${name}'s Organization`, `superadmin-${newUser.id}`, newUser.id]
    );

    const org = orgResult.rows[0];
    console.log(`  Organization: ${org.name} (ID: ${org.id})`);

    // Add superadmin as admin of their organization
    await db.query(
      `INSERT INTO organization_members (org_id, user_id, role, status, joined_at)
       VALUES ($1, $2, 'admin', 'active', CURRENT_TIMESTAMP)`,
      [org.id, newUser.id]
    );

    console.log('\n' + '='.repeat(60));
    console.log('SUPERADMIN CREATION COMPLETE');
    console.log('='.repeat(60));
    console.log('\nLogin credentials:');
    console.log(`  URL: /admin/login`);
    console.log(`  Email: ${email}`);
    console.log(`  Password: ${password}`);
    console.log('\n[WARNING] Change the password after first login!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n[ERROR] Failed to create superadmin:', error.message);
    if (error.code === '23505') {
      console.error('A user with this email already exists.');
    }
    process.exit(1);
  } finally {
    await db.end();
  }
}

// Run the script
createSuperadmin();
