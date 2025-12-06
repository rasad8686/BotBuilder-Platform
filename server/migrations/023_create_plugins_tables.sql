-- Plugin Marketplace Tables Migration

-- Plugin Categories
CREATE TABLE IF NOT EXISTS plugin_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  icon VARCHAR(50),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Plugins
CREATE TABLE IF NOT EXISTS plugins (
  id SERIAL PRIMARY KEY,
  developer_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
  category_id INTEGER REFERENCES plugin_categories(id),
  icon_url TEXT,
  banner_url TEXT,
  price DECIMAL(10,2) DEFAULT 0,
  is_free BOOLEAN DEFAULT true,
  status VARCHAR(50) DEFAULT 'pending',
  downloads INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  manifest JSONB DEFAULT '{}',
  permissions JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Plugin Versions
CREATE TABLE IF NOT EXISTS plugin_versions (
  id SERIAL PRIMARY KEY,
  plugin_id INTEGER NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  version VARCHAR(50) NOT NULL,
  changelog TEXT,
  file_url TEXT,
  min_platform_version VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(plugin_id, version)
);

-- Plugin Installations
CREATE TABLE IF NOT EXISTS plugin_installations (
  id SERIAL PRIMARY KEY,
  plugin_id INTEGER NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL,
  installed_version VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  settings JSONB DEFAULT '{}',
  installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(plugin_id, tenant_id)
);

-- Plugin Reviews
CREATE TABLE IF NOT EXISTS plugin_reviews (
  id SERIAL PRIMARY KEY,
  plugin_id INTEGER NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(plugin_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_plugins_developer ON plugins(developer_id);
CREATE INDEX IF NOT EXISTS idx_plugins_category ON plugins(category_id);
CREATE INDEX IF NOT EXISTS idx_plugins_status ON plugins(status);
CREATE INDEX IF NOT EXISTS idx_plugins_slug ON plugins(slug);
CREATE INDEX IF NOT EXISTS idx_plugin_versions_plugin ON plugin_versions(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_installations_tenant ON plugin_installations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_plugin_installations_plugin ON plugin_installations(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_reviews_plugin ON plugin_reviews(plugin_id);

-- Insert default categories
INSERT INTO plugin_categories (name, slug, icon, description) VALUES
  ('AI & Automation', 'ai-automation', '🤖', 'AI-powered tools and automation plugins'),
  ('Analytics', 'analytics', '📊', 'Analytics and reporting plugins'),
  ('Communication', 'communication', '💬', 'Messaging and communication integrations'),
  ('CRM', 'crm', '👥', 'Customer relationship management'),
  ('E-commerce', 'ecommerce', '🛒', 'Shopping and payment integrations'),
  ('Marketing', 'marketing', '📣', 'Marketing and promotion tools'),
  ('Productivity', 'productivity', '⚡', 'Workflow and productivity enhancers'),
  ('Security', 'security', '🔒', 'Security and compliance tools'),
  ('Social Media', 'social-media', '📱', 'Social media integrations'),
  ('Utilities', 'utilities', '🔧', 'General utility plugins')
ON CONFLICT (slug) DO NOTHING;
