-- Migration: White-label Settings
-- Description: Add white-label/custom branding support for organizations
-- Date: 2025-10-31

-- Create whitelabel_settings table
CREATE TABLE IF NOT EXISTS whitelabel_settings (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,

  -- Brand Identity
  brand_name VARCHAR(100) DEFAULT 'BotBuilder',
  logo_url TEXT,
  logo_dark_url TEXT,
  favicon_url TEXT,

  -- Color Scheme (hex colors)
  primary_color VARCHAR(7) DEFAULT '#8b5cf6',
  secondary_color VARCHAR(7) DEFAULT '#6366f1',
  accent_color VARCHAR(7) DEFAULT '#ec4899',
  background_color VARCHAR(7) DEFAULT '#ffffff',
  text_color VARCHAR(7) DEFAULT '#1f2937',

  -- Custom Domain
  custom_domain VARCHAR(255),
  custom_domain_verified BOOLEAN DEFAULT false,

  -- Contact Information
  support_email VARCHAR(255),
  company_name VARCHAR(255),
  company_website VARCHAR(255),

  -- Email Branding
  email_from_name VARCHAR(100),
  email_from_address VARCHAR(255),
  email_header_color VARCHAR(7),
  email_footer_text TEXT,

  -- Legal Links
  privacy_policy_url TEXT,
  terms_of_service_url TEXT,

  -- Features
  show_powered_by BOOLEAN DEFAULT true,
  custom_css TEXT,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_whitelabel_domain ON whitelabel_settings(custom_domain);
CREATE INDEX IF NOT EXISTS idx_whitelabel_org ON whitelabel_settings(organization_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_whitelabel_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER whitelabel_updated_at_trigger
  BEFORE UPDATE ON whitelabel_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_whitelabel_updated_at();

-- Create default whitelabel settings for existing organizations
INSERT INTO whitelabel_settings (organization_id, brand_name, show_powered_by)
SELECT id, 'BotBuilder', true
FROM organizations
WHERE id NOT IN (SELECT organization_id FROM whitelabel_settings WHERE organization_id IS NOT NULL)
ON CONFLICT (organization_id) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE whitelabel_settings IS 'White-label/custom branding settings for organizations';
COMMENT ON COLUMN whitelabel_settings.organization_id IS 'Organization that owns these branding settings';
COMMENT ON COLUMN whitelabel_settings.brand_name IS 'Custom brand name to display throughout the platform';
COMMENT ON COLUMN whitelabel_settings.logo_url IS 'URL to custom logo (light mode)';
COMMENT ON COLUMN whitelabel_settings.logo_dark_url IS 'URL to custom logo (dark mode)';
COMMENT ON COLUMN whitelabel_settings.favicon_url IS 'URL to custom favicon';
COMMENT ON COLUMN whitelabel_settings.custom_domain IS 'Custom domain for white-label deployment';
COMMENT ON COLUMN whitelabel_settings.custom_domain_verified IS 'Whether custom domain DNS is verified';
COMMENT ON COLUMN whitelabel_settings.show_powered_by IS 'Whether to show "Powered by BotBuilder" branding';
COMMENT ON COLUMN whitelabel_settings.custom_css IS 'Custom CSS to inject into the platform';
