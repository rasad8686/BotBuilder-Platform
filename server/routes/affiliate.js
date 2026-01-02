const express = require('express');
const router = express.Router();
const affiliateService = require('../services/affiliateService');
const authMiddleware = require('../middleware/auth');
const log = require('../utils/logger');

// ==================== Public Routes ====================

// Track affiliate click and redirect
router.get('/r/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const link = await affiliateService.getLinkBySlug(slug);

    if (!link || !link.is_active || link.affiliate_status !== 'active') {
      return res.redirect('/');
    }

    // Track click
    const clickData = {
      ipAddress: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      userAgent: req.headers['user-agent'] || '',
      referrer: req.headers['referer'] || '',
      country: req.headers['cf-ipcountry'] || '',
      device: parseDevice(req.headers['user-agent']),
      browser: parseBrowser(req.headers['user-agent'])
    };

    await affiliateService.trackClick(link.affiliate_id, link.id, clickData);

    // Set affiliate cookie for conversion tracking
    res.cookie('affiliate_code', link.affiliate_code, {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    });

    res.cookie('affiliate_link', link.id, {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    });

    res.redirect(link.destination_url);
  } catch (error) {
    log.error('Affiliate redirect error', { error: error.message });
    res.redirect('/');
  }
});

// ==================== Authenticated Routes ====================

// Get affiliate account
router.get('/account', authMiddleware, async (req, res) => {
  try {
    const affiliate = await affiliateService.getAffiliateByUserId(req.user.id);

    if (!affiliate) {
      return res.json({ success: true, affiliate: null });
    }

    res.json({ success: true, affiliate });
  } catch (error) {
    log.error('Get affiliate account error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to get affiliate account' });
  }
});

// Register as affiliate
router.post('/register', authMiddleware, async (req, res) => {
  try {
    const existing = await affiliateService.getAffiliateByUserId(req.user.id);

    if (existing) {
      return res.status(400).json({ success: false, message: 'Already registered as affiliate' });
    }

    const affiliate = await affiliateService.createAffiliate(req.user.id, req.body);
    res.json({ success: true, affiliate });
  } catch (error) {
    log.error('Register affiliate error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to register as affiliate' });
  }
});

// Update payment settings
router.put('/payment-settings', authMiddleware, async (req, res) => {
  try {
    const affiliate = await affiliateService.getAffiliateByUserId(req.user.id);

    if (!affiliate) {
      return res.status(404).json({ success: false, message: 'Affiliate account not found' });
    }

    const { paymentMethod, paymentDetails } = req.body;
    const updated = await affiliateService.updatePaymentSettings(
      affiliate.id,
      paymentMethod,
      paymentDetails
    );

    res.json({ success: true, affiliate: updated });
  } catch (error) {
    log.error('Update payment settings error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to update payment settings' });
  }
});

// Get dashboard stats
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const affiliate = await affiliateService.getAffiliateByUserId(req.user.id);

    if (!affiliate) {
      return res.status(404).json({ success: false, message: 'Affiliate account not found' });
    }

    const { period } = req.query;
    const stats = await affiliateService.getDashboardStats(affiliate.id, period);

    res.json({ success: true, ...stats });
  } catch (error) {
    log.error('Get dashboard error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to get dashboard stats' });
  }
});

// ==================== Links ====================

// Get all links
router.get('/links', authMiddleware, async (req, res) => {
  try {
    const affiliate = await affiliateService.getAffiliateByUserId(req.user.id);

    if (!affiliate) {
      return res.status(404).json({ success: false, message: 'Affiliate account not found' });
    }

    const links = await affiliateService.getLinks(affiliate.id);
    res.json({ success: true, links });
  } catch (error) {
    log.error('Get links error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to get links' });
  }
});

// Create link
router.post('/links', authMiddleware, async (req, res) => {
  try {
    const affiliate = await affiliateService.getAffiliateByUserId(req.user.id);

    if (!affiliate) {
      return res.status(404).json({ success: false, message: 'Affiliate account not found' });
    }

    if (affiliate.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Affiliate account not active' });
    }

    const link = await affiliateService.createLink(affiliate.id, req.body);
    res.json({ success: true, link });
  } catch (error) {
    log.error('Create link error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to create link' });
  }
});

// Update link
router.put('/links/:linkId', authMiddleware, async (req, res) => {
  try {
    const affiliate = await affiliateService.getAffiliateByUserId(req.user.id);

    if (!affiliate) {
      return res.status(404).json({ success: false, message: 'Affiliate account not found' });
    }

    const link = await affiliateService.updateLink(req.params.linkId, affiliate.id, req.body);

    if (!link) {
      return res.status(404).json({ success: false, message: 'Link not found' });
    }

    res.json({ success: true, link });
  } catch (error) {
    log.error('Update link error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to update link' });
  }
});

// Delete link
router.delete('/links/:linkId', authMiddleware, async (req, res) => {
  try {
    const affiliate = await affiliateService.getAffiliateByUserId(req.user.id);

    if (!affiliate) {
      return res.status(404).json({ success: false, message: 'Affiliate account not found' });
    }

    await affiliateService.deleteLink(req.params.linkId, affiliate.id);
    res.json({ success: true });
  } catch (error) {
    log.error('Delete link error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to delete link' });
  }
});

// ==================== Conversions ====================

// Get conversions
router.get('/conversions', authMiddleware, async (req, res) => {
  try {
    const affiliate = await affiliateService.getAffiliateByUserId(req.user.id);

    if (!affiliate) {
      return res.status(404).json({ success: false, message: 'Affiliate account not found' });
    }

    const { status, startDate, endDate, limit } = req.query;
    const conversions = await affiliateService.getConversions(affiliate.id, {
      status,
      startDate,
      endDate,
      limit: limit ? parseInt(limit) : undefined
    });

    res.json({ success: true, conversions });
  } catch (error) {
    log.error('Get conversions error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to get conversions' });
  }
});

// ==================== Payouts ====================

// Get payouts
router.get('/payouts', authMiddleware, async (req, res) => {
  try {
    const affiliate = await affiliateService.getAffiliateByUserId(req.user.id);

    if (!affiliate) {
      return res.status(404).json({ success: false, message: 'Affiliate account not found' });
    }

    const payouts = await affiliateService.getPayouts(affiliate.id);
    res.json({ success: true, payouts });
  } catch (error) {
    log.error('Get payouts error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to get payouts' });
  }
});

// Request payout
router.post('/payouts', authMiddleware, async (req, res) => {
  try {
    const affiliate = await affiliateService.getAffiliateByUserId(req.user.id);

    if (!affiliate) {
      return res.status(404).json({ success: false, message: 'Affiliate account not found' });
    }

    if (affiliate.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Affiliate account not active' });
    }

    if (!affiliate.payment_method) {
      return res.status(400).json({ success: false, message: 'Please set up payment method first' });
    }

    const { amount } = req.body;
    const payout = await affiliateService.requestPayout(affiliate.id, amount);

    res.json({ success: true, payout });
  } catch (error) {
    log.error('Request payout error', { error: error.message });
    res.status(400).json({ success: false, message: error.message });
  }
});

// ==================== Assets ====================

// Get marketing assets
router.get('/assets', authMiddleware, async (req, res) => {
  try {
    const affiliate = await affiliateService.getAffiliateByUserId(req.user.id);

    if (!affiliate) {
      return res.status(404).json({ success: false, message: 'Affiliate account not found' });
    }

    // Return static marketing assets
    const assets = {
      banners: [
        { id: 1, name: 'Banner 728x90', size: '728x90', url: '/assets/affiliate/banner-728x90.png' },
        { id: 2, name: 'Banner 300x250', size: '300x250', url: '/assets/affiliate/banner-300x250.png' },
        { id: 3, name: 'Banner 160x600', size: '160x600', url: '/assets/affiliate/banner-160x600.png' },
        { id: 4, name: 'Banner 320x50', size: '320x50', url: '/assets/affiliate/banner-320x50.png' }
      ],
      logos: [
        { id: 1, name: 'Logo Dark', url: '/assets/affiliate/logo-dark.png' },
        { id: 2, name: 'Logo Light', url: '/assets/affiliate/logo-light.png' },
        { id: 3, name: 'Logo Icon', url: '/assets/affiliate/logo-icon.png' }
      ],
      emailTemplates: [
        { id: 1, name: 'Welcome Email', subject: 'Discover BotBuilder - AI Chatbots Made Easy' },
        { id: 2, name: 'Feature Highlight', subject: 'See What BotBuilder Can Do For You' },
        { id: 3, name: 'Special Offer', subject: 'Exclusive Deal: Get 20% Off BotBuilder' }
      ],
      socialPosts: [
        { id: 1, platform: 'twitter', content: 'Build AI chatbots in minutes with @BotBuilder! No coding required. Try it free!' },
        { id: 2, platform: 'linkedin', content: 'Transform your customer service with AI-powered chatbots. BotBuilder makes it easy to create, deploy, and manage intelligent bots.' },
        { id: 3, platform: 'facebook', content: 'Ready to automate your customer conversations? BotBuilder helps you create smart chatbots without writing a single line of code!' }
      ]
    };

    res.json({ success: true, assets, affiliateCode: affiliate.affiliate_code });
  } catch (error) {
    log.error('Get assets error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to get assets' });
  }
});

// ==================== Helper Functions ====================

function parseDevice(userAgent) {
  if (!userAgent) return 'unknown';
  if (/mobile/i.test(userAgent)) return 'mobile';
  if (/tablet/i.test(userAgent)) return 'tablet';
  return 'desktop';
}

function parseBrowser(userAgent) {
  if (!userAgent) return 'unknown';
  if (/chrome/i.test(userAgent)) return 'chrome';
  if (/firefox/i.test(userAgent)) return 'firefox';
  if (/safari/i.test(userAgent)) return 'safari';
  if (/edge/i.test(userAgent)) return 'edge';
  if (/msie|trident/i.test(userAgent)) return 'ie';
  return 'other';
}

module.exports = router;
