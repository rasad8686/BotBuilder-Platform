/**
 * Demo User Seed
 * Creates demo user and organization for testing
 */

const bcrypt = require('bcryptjs');

exports.seed = async function(knex) {
  const demoEmail = 'demo@botbuilder.com';
  const demoPassword = 'demo123';
  const demoOrgSlug = 'demo';

  // Check if demo user already exists
  let demoUser = await knex('users').where('email', demoEmail).first();
  if (demoUser) {
    console.log('Demo user already exists, skipping...');
    return;
  }

  // Hash password
  const passwordHash = await bcrypt.hash(demoPassword, 10);

  // Create demo user first
  [demoUser] = await knex('users').insert({
    name: 'Demo User',
    email: demoEmail,
    password_hash: passwordHash,
    email_verified: true,
    created_at: new Date(),
    updated_at: new Date()
  }).returning('*');

  console.log('Demo user created:', demoUser.id);

  // Check if demo organization already exists
  let demoOrg = await knex('organizations').where('slug', demoOrgSlug).first();

  // Create demo organization if not exists (with owner_id)
  if (!demoOrg) {
    [demoOrg] = await knex('organizations').insert({
      name: 'Demo Company',
      slug: demoOrgSlug,
      plan_tier: 'pro',
      owner_id: demoUser.id,
      created_at: new Date(),
      updated_at: new Date()
    }).returning('*');
    console.log('Demo organization created:', demoOrg.id);
  }

  // Add user to organization as admin
  await knex('organization_members').insert({
    user_id: demoUser.id,
    org_id: demoOrg.id,
    role: 'admin',
    status: 'active',
    joined_at: new Date()
  });

  console.log('Demo user added to organization as admin');

  // Create demo bots
  const demoBots = [
    {
      user_id: demoUser.id,
      organization_id: demoOrg.id,
      name: 'Customer Support Bot',
      description: 'A demo chatbot for customer support',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      user_id: demoUser.id,
      organization_id: demoOrg.id,
      name: 'Sales Assistant Bot',
      description: 'A demo chatbot for sales inquiries',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    }
  ];

  await knex('bots').insert(demoBots);
  console.log('Demo bots created');

  // Create demo surveys
  const demoSurveys = [
    {
      org_id: demoOrg.id,
      created_by: demoUser.id,
      name: 'Customer Satisfaction Survey',
      description: 'Measure customer satisfaction with our service',
      status: 'active',
      trigger_type: 'manual',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      org_id: demoOrg.id,
      created_by: demoUser.id,
      name: 'Product Feedback Survey',
      description: 'Gather feedback about our product features',
      status: 'draft',
      trigger_type: 'event',
      created_at: new Date(),
      updated_at: new Date()
    }
  ];

  // Check if surveys table exists before inserting
  const hasSurveys = await knex.schema.hasTable('surveys');
  if (hasSurveys) {
    await knex('surveys').insert(demoSurveys);
    console.log('Demo surveys created');
  }

  console.log('Demo seed completed successfully!');
  console.log('Login credentials:');
  console.log('  Email: demo@botbuilder.com');
  console.log('  Password: demo123');
};
