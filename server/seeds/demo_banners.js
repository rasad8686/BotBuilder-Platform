/**
 * Demo Banners Seed
 * Creates test banners for development and testing
 */

exports.seed = async function(knex) {
  // Check if banners table exists
  const hasBanners = await knex.schema.hasTable('banners');
  if (!hasBanners) {
    console.log('Banners table does not exist, skipping...');
    return;
  }

  // Get demo organization
  const demoOrg = await knex('organizations').where('slug', 'demo').first();
  if (!demoOrg) {
    console.log('Demo organization not found, skipping banner seed...');
    return;
  }

  // Get demo user
  const demoUser = await knex('users').where('email', 'demo@botbuilder.com').first();
  if (!demoUser) {
    console.log('Demo user not found, skipping banner seed...');
    return;
  }

  // Check if banners already exist
  const existingBanners = await knex('banners').where('org_id', demoOrg.id).first();
  if (existingBanners) {
    console.log('Demo banners already exist, skipping...');
    return;
  }

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const demoBanners = [
    // Banner 1 - Info
    {
      org_id: demoOrg.id,
      created_by: demoUser.id,
      title: 'Yeni Xüsusiyyət!',
      message: 'Voice AI artıq bütün planlarda aktivdir. Sınayın!',
      type: 'info',
      link_url: '/features/voice-ai',
      link_text: 'Öyrən',
      target_audience: 'all',
      start_date: now,
      end_date: nextMonth,
      is_dismissible: true,
      is_active: true,
      priority: 50,
      created_at: now,
      updated_at: now
    },
    // Banner 2 - Warning
    {
      org_id: demoOrg.id,
      created_by: demoUser.id,
      title: 'Plan Xəbərdarlığı',
      message: 'Trial müddətiniz 3 gün sonra bitir.',
      type: 'warning',
      link_url: '/billing',
      link_text: 'Yenilə',
      target_audience: 'trial',
      start_date: now,
      end_date: nextWeek,
      is_dismissible: true,
      is_active: true,
      priority: 80,
      created_at: now,
      updated_at: now
    },
    // Banner 3 - Promo
    {
      org_id: demoOrg.id,
      created_by: demoUser.id,
      title: 'Xüsusi Təklif!',
      message: 'Bu həftə Enterprise plana 30% endirim!',
      type: 'promo',
      link_url: '/billing/upgrade',
      link_text: 'İndi Al',
      target_audience: 'free',
      start_date: now,
      end_date: nextWeek,
      is_dismissible: true,
      is_active: true,
      priority: 90,
      background_color: '#7c3aed',
      text_color: '#ffffff',
      created_at: now,
      updated_at: now
    },
    // Banner 4 - Success (maintenance complete)
    {
      org_id: demoOrg.id,
      created_by: demoUser.id,
      title: 'Texniki işlər tamamlandı',
      message: 'Bütün xidmətlər normal işləyir. Anlayışınız üçün təşəkkür edirik!',
      type: 'success',
      link_url: null,
      link_text: null,
      target_audience: 'all',
      start_date: now,
      end_date: tomorrow,
      is_dismissible: true,
      is_active: true,
      priority: 100,
      created_at: now,
      updated_at: now
    },
    // Banner 5 - Error (example - inactive)
    {
      org_id: demoOrg.id,
      created_by: demoUser.id,
      title: 'Sistem Xətası',
      message: 'Webhook xidmətində gecikmələr yaşanır. Həll olunur...',
      type: 'error',
      link_url: '/status',
      link_text: 'Status',
      target_audience: 'all',
      start_date: now,
      end_date: nextWeek,
      is_dismissible: false,
      is_active: false, // Inactive for demo purposes
      priority: 100,
      created_at: now,
      updated_at: now
    }
  ];

  await knex('banners').insert(demoBanners);
  console.log('Demo banners created successfully!');
  console.log('Created banners:');
  console.log('  1. Info - Yeni Xüsusiyyət (all users)');
  console.log('  2. Warning - Plan Xəbərdarlığı (trial users)');
  console.log('  3. Promo - Xüsusi Təklif (free users)');
  console.log('  4. Success - Texniki işlər tamamlandı (all users)');
  console.log('  5. Error - Sistem Xətası (inactive)');
};
