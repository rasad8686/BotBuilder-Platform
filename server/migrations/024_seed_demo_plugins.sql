-- Seed Demo Plugins for Marketplace
-- Run this after 023_create_plugins_tables.sql

-- First, ensure categories exist (get their IDs)
-- Categories from 023: AI & Automation(1), Analytics(2), Communication(3), CRM(4), E-commerce(5),
-- Marketing(6), Productivity(7), Security(8), Social Media(9), Utilities(10)

-- Insert demo plugins
INSERT INTO plugins (
    developer_id,
    name,
    slug,
    description,
    category_id,
    version,
    icon_url,
    banner_url,
    price,
    is_free,
    status,
    downloads,
    rating,
    review_count,
    manifest,
    permissions,
    created_at,
    updated_at
) VALUES
-- 1. WhatsApp Integration (Communication, Free)
(
    1,
    'WhatsApp Integration',
    'whatsapp-integration',
    'Connect your bots to WhatsApp Business API. Send and receive messages, media, and templates. Supports multi-device, webhooks, and real-time notifications. Perfect for customer support and marketing automation.',
    3, -- Communication
    '2.1.0',
    'https://cdn.simpleicons.org/whatsapp/25D366',
    NULL,
    0,
    true,
    'published',
    12543,
    4.8,
    287,
    '{"name": "whatsapp-integration", "version": "2.1.0", "type": "channel", "main": "index.js", "features": ["Multi-device support", "Media messages", "Template messages", "Webhooks", "Read receipts"]}',
    '["send_messages", "read_messages", "webhook_access"]',
    NOW() - INTERVAL '45 days',
    NOW() - INTERVAL '3 days'
),

-- 2. OpenAI GPT-4 Connector (AI & Automation, $9.99)
(
    1,
    'OpenAI GPT-4 Connector',
    'openai-gpt4-connector',
    'Integrate OpenAI GPT-4 and GPT-4 Turbo into your bots. Features include conversation memory, function calling, vision capabilities, and streaming responses. Build intelligent AI assistants with ease.',
    1, -- AI & Automation
    '3.0.2',
    'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/openai.svg',
    NULL,
    9.99,
    false,
    'published',
    8921,
    4.9,
    412,
    '{"name": "openai-gpt4-connector", "version": "3.0.2", "type": "ai", "main": "index.js", "features": ["GPT-4 & GPT-4 Turbo", "Function calling", "Vision support", "Streaming responses", "Conversation memory", "Token optimization"]}',
    '["external_api", "read_messages", "send_messages"]',
    NOW() - INTERVAL '60 days',
    NOW() - INTERVAL '1 day'
),

-- 3. Google Analytics (Analytics, Free)
(
    1,
    'Google Analytics',
    'google-analytics',
    'Track bot interactions with Google Analytics 4. Monitor user engagement, conversation flows, conversion funnels, and custom events. Includes dashboard widgets and automated reporting.',
    2, -- Analytics
    '1.5.0',
    'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/google/google-original.svg',
    NULL,
    0,
    true,
    'published',
    6234,
    4.5,
    156,
    '{"name": "google-analytics", "version": "1.5.0", "type": "integration", "main": "index.js", "features": ["GA4 integration", "Custom events", "Conversion tracking", "Dashboard widgets", "Automated reports"]}',
    '["analytics_access", "read_messages"]',
    NOW() - INTERVAL '90 days',
    NOW() - INTERVAL '14 days'
),

-- 4. Stripe Payments (E-commerce, $19.99)
(
    1,
    'Stripe Payments',
    'stripe-payments',
    'Accept payments directly in your bot conversations. Supports one-time payments, subscriptions, invoices, and refunds. PCI compliant with 3D Secure support. Perfect for e-commerce bots.',
    5, -- E-commerce
    '2.3.1',
    'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/stripe.svg',
    NULL,
    19.99,
    false,
    'published',
    4567,
    4.7,
    198,
    '{"name": "stripe-payments", "version": "2.3.1", "type": "integration", "main": "index.js", "features": ["One-time payments", "Subscriptions", "Invoices", "Refunds", "3D Secure", "Multiple currencies"]}',
    '["external_api", "send_messages", "webhook_access"]',
    NOW() - INTERVAL '120 days',
    NOW() - INTERVAL '7 days'
),

-- 5. Email Marketing (Marketing, $4.99)
(
    1,
    'Email Marketing',
    'email-marketing',
    'Send automated email campaigns from your bots. Integrates with Mailchimp, SendGrid, and SMTP. Features include templates, scheduling, A/B testing, and analytics. Grow your email list automatically.',
    6, -- Marketing
    '1.8.0',
    'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/google/google-original.svg',
    NULL,
    4.99,
    false,
    'published',
    3892,
    4.4,
    134,
    '{"name": "email-marketing", "version": "1.8.0", "type": "integration", "main": "index.js", "features": ["Mailchimp integration", "SendGrid support", "Email templates", "Scheduling", "A/B testing", "Analytics"]}',
    '["external_api", "read_users", "send_messages"]',
    NOW() - INTERVAL '75 days',
    NOW() - INTERVAL '10 days'
)
ON CONFLICT (slug) DO UPDATE SET
    description = EXCLUDED.description,
    version = EXCLUDED.version,
    downloads = EXCLUDED.downloads,
    rating = EXCLUDED.rating,
    review_count = EXCLUDED.review_count,
    updated_at = NOW();

-- Add some demo reviews for the plugins
INSERT INTO plugin_reviews (plugin_id, user_id, rating, comment, created_at)
SELECT
    p.id,
    1,
    5,
    'Excellent plugin! Works perfectly with my bots.',
    NOW() - INTERVAL '10 days'
FROM plugins p WHERE p.slug = 'whatsapp-integration'
ON CONFLICT DO NOTHING;

INSERT INTO plugin_reviews (plugin_id, user_id, rating, comment, created_at)
SELECT
    p.id,
    1,
    5,
    'GPT-4 integration is seamless. Great documentation!',
    NOW() - INTERVAL '5 days'
FROM plugins p WHERE p.slug = 'openai-gpt4-connector'
ON CONFLICT DO NOTHING;

INSERT INTO plugin_reviews (plugin_id, user_id, rating, comment, created_at)
SELECT
    p.id,
    1,
    4,
    'Good analytics integration. Would love more custom events.',
    NOW() - INTERVAL '20 days'
FROM plugins p WHERE p.slug = 'google-analytics'
ON CONFLICT DO NOTHING;

SELECT 'Demo plugins seeded successfully!' as result;
