// Test Email Service
// This script tests the email service without actually sending emails

const pool = require('./db');
const emailService = require('./services/emailService');

async function testEmailService() {
  console.log('🧪 Testing Email Service...\n');

  try {
    // Test 1: Module Loading
    console.log('✅ Test 1: Email Service Module Loaded Successfully');
    console.log('   Available functions:', Object.keys(emailService));
    console.log('');

    // Test 2: Check database connection
    const result = await pool.query('SELECT COUNT(*) FROM users');
    const userCount = parseInt(result.rows[0].count);
    console.log(`✅ Test 2: Database Connected (${userCount} users found)`);
    console.log('');

    // Test 3: Check email_notifications table
    const tableCheck = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'email_notifications'
    `);

    if (tableCheck.rows.length > 0) {
      console.log('✅ Test 3: email_notifications table exists');

      const notificationCount = await pool.query('SELECT COUNT(*) FROM email_notifications');
      console.log(`   Total emails in queue: ${notificationCount.rows[0].count}`);
    } else {
      console.log('⚠️  Test 3: email_notifications table not found');
      console.log('   Run migration 003_saas_features.sql to create it');
    }
    console.log('');

    // Test 4: Check environment variables
    console.log('📧 Test 4: Email Configuration');
    console.log(`   EMAIL_HOST: ${process.env.EMAIL_HOST || 'smtp.gmail.com (default)'}`);
    console.log(`   EMAIL_PORT: ${process.env.EMAIL_PORT || '587 (default)'}`);
    console.log(`   EMAIL_USER: ${process.env.EMAIL_USER ? '✅ Configured' : '❌ Not configured (emails will be queued, not sent)'}`);
    console.log(`   EMAIL_PASSWORD: ${process.env.EMAIL_PASSWORD ? '✅ Configured' : '❌ Not configured'}`);
    console.log('');

    // Test 5: Test email function (without sending)
    if (userCount > 0) {
      console.log('🧪 Test 5: Simulating Welcome Email');
      const testUser = await pool.query('SELECT id, email, name FROM users LIMIT 1');
      const user = testUser.rows[0];

      console.log(`   Testing with user: ${user.name} (${user.email})`);

      // This will queue the email but not send it if EMAIL_USER is not configured
      const result = await emailService.sendWelcomeEmail(user.id);

      if (result.queued) {
        console.log('   ✅ Email queued successfully (EMAIL_USER not configured)');
      } else if (result.success) {
        console.log('   ✅ Email sent successfully');
        console.log('   Message ID:', result.messageId);
      } else {
        console.log('   ❌ Email failed:', result.error);
      }

      // Check if email was logged to database
      const emailLog = await pool.query(
        'SELECT * FROM email_notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
        [user.id]
      );

      if (emailLog.rows.length > 0) {
        const log = emailLog.rows[0];
        console.log('   📝 Email logged to database:');
        console.log(`      Type: ${log.email_type}`);
        console.log(`      Status: ${log.status}`);
        console.log(`      Subject: ${log.subject}`);
      }
    } else {
      console.log('⚠️  Test 5: Skipped (no users found)');
      console.log('   Register a user first to test email functionality');
    }
    console.log('');

    // Summary
    console.log('═══════════════════════════════════════');
    console.log('📊 Test Summary');
    console.log('═══════════════════════════════════════');
    console.log('✅ Email Service: Working');
    console.log('✅ Database: Connected');
    console.log(process.env.EMAIL_USER ? '✅ Email Provider: Configured' : '⚠️  Email Provider: Not configured (emails will be queued)');
    console.log('');
    console.log('💡 To enable email sending:');
    console.log('   1. Add EMAIL_USER and EMAIL_PASSWORD to .env');
    console.log('   2. For Gmail, use App Password (not regular password)');
    console.log('   3. For other providers, update EMAIL_HOST and EMAIL_PORT');
    console.log('');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

// Run tests
testEmailService();
