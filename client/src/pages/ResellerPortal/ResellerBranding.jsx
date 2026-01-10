import React, { useState, useEffect } from 'react';
import {
  Palette,
  Image,
  Globe,
  Save,
  Lock,
  Award,
  Check,
  ArrowUpRight
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function ResellerBranding() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [branding, setBranding] = useState({
    logo_url: '',
    primary_color: '#3B82F6',
    secondary_color: '#1E40AF',
    company_name: '',
    custom_domain: ''
  });
  const [tier, setTier] = useState('silver');
  const [features, setFeatures] = useState({
    custom_logo: false,
    custom_colors: false,
    custom_domain: false,
    white_label_emails: false
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchBranding();
  }, []);

  const fetchBranding = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/reseller/branding`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (data.success) {
        setBranding({
          logo_url: data.branding.logo_url || '',
          primary_color: data.branding.primary_color || '#3B82F6',
          secondary_color: data.branding.secondary_color || '#1E40AF',
          company_name: data.branding.company_name || '',
          custom_domain: data.branding.custom_domain || ''
        });
        setTier(data.tier);
        setFeatures(data.features);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to load branding settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/reseller/branding`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(branding)
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Branding settings saved successfully');
        setBranding(data.branding);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to save branding settings');
    } finally {
      setSaving(false);
    }
  };

  const getTierColor = (t) => {
    switch (t) {
      case 'platinum': return 'text-purple-400 bg-purple-500/20 border-purple-500/30';
      case 'gold': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      default: return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Branding Settings</h1>
          <p className="text-gray-400 mt-1">Customize your white-label experience</p>
        </div>
        <div className={`px-4 py-2 rounded-full border ${getTierColor(tier)}`}>
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4" />
            <span className="font-medium capitalize">{tier} Tier</span>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-green-400 flex items-center gap-2">
          <Check className="w-4 h-4" />
          {success}
        </div>
      )}

      {/* Tier Features */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h3 className="text-white font-medium mb-4">Your Tier Features</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`p-4 rounded-lg border ${features.custom_logo ? 'bg-green-500/10 border-green-500/30' : 'bg-gray-700/50 border-gray-600'}`}>
            <div className="flex items-center gap-2 mb-2">
              {features.custom_logo ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Lock className="w-4 h-4 text-gray-500" />
              )}
              <span className={features.custom_logo ? 'text-green-400' : 'text-gray-500'}>
                Custom Logo
              </span>
            </div>
            <p className="text-gray-500 text-xs">Gold+ required</p>
          </div>

          <div className={`p-4 rounded-lg border ${features.custom_colors ? 'bg-green-500/10 border-green-500/30' : 'bg-gray-700/50 border-gray-600'}`}>
            <div className="flex items-center gap-2 mb-2">
              {features.custom_colors ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Lock className="w-4 h-4 text-gray-500" />
              )}
              <span className={features.custom_colors ? 'text-green-400' : 'text-gray-500'}>
                Custom Colors
              </span>
            </div>
            <p className="text-gray-500 text-xs">Gold+ required</p>
          </div>

          <div className={`p-4 rounded-lg border ${features.custom_domain ? 'bg-green-500/10 border-green-500/30' : 'bg-gray-700/50 border-gray-600'}`}>
            <div className="flex items-center gap-2 mb-2">
              {features.custom_domain ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Lock className="w-4 h-4 text-gray-500" />
              )}
              <span className={features.custom_domain ? 'text-green-400' : 'text-gray-500'}>
                Custom Domain
              </span>
            </div>
            <p className="text-gray-500 text-xs">Platinum required</p>
          </div>

          <div className={`p-4 rounded-lg border ${features.white_label_emails ? 'bg-green-500/10 border-green-500/30' : 'bg-gray-700/50 border-gray-600'}`}>
            <div className="flex items-center gap-2 mb-2">
              {features.white_label_emails ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Lock className="w-4 h-4 text-gray-500" />
              )}
              <span className={features.white_label_emails ? 'text-green-400' : 'text-gray-500'}>
                White-label Emails
              </span>
            </div>
            <p className="text-gray-500 text-xs">Platinum required</p>
          </div>
        </div>

        {tier === 'silver' && (
          <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-blue-400">
              Upgrade to Gold or Platinum to unlock custom branding features.
              <button className="ml-2 underline hover:no-underline inline-flex items-center gap-1">
                Contact Sales
                <ArrowUpRight className="w-3 h-3" />
              </button>
            </p>
          </div>
        )}
      </div>

      {/* Branding Form */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h3 className="text-white font-medium mb-4">Branding Configuration</h3>

        <div className="space-y-6">
          {/* Company Name */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">Company Name</label>
            <input
              type="text"
              value={branding.company_name}
              onChange={(e) => setBranding({ ...branding, company_name: e.target.value })}
              disabled={!features.custom_logo}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Your Company Name"
            />
          </div>

          {/* Logo URL */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              <div className="flex items-center gap-2">
                <Image className="w-4 h-4" />
                Logo URL
              </div>
            </label>
            <input
              type="url"
              value={branding.logo_url}
              onChange={(e) => setBranding({ ...branding, logo_url: e.target.value })}
              disabled={!features.custom_logo}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="https://example.com/logo.png"
            />
            {branding.logo_url && features.custom_logo && (
              <div className="mt-3 p-4 bg-gray-700/50 rounded-lg">
                <p className="text-gray-400 text-sm mb-2">Preview:</p>
                <img
                  src={branding.logo_url}
                  alt="Logo Preview"
                  className="max-h-16 object-contain"
                  onError={(e) => e.target.style.display = 'none'}
                />
              </div>
            )}
          </div>

          {/* Colors */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  Primary Color
                </div>
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={branding.primary_color}
                  onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                  disabled={!features.custom_colors}
                  className="w-12 h-10 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <input
                  type="text"
                  value={branding.primary_color}
                  onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                  disabled={!features.custom_colors}
                  className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-2">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  Secondary Color
                </div>
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={branding.secondary_color}
                  onChange={(e) => setBranding({ ...branding, secondary_color: e.target.value })}
                  disabled={!features.custom_colors}
                  className="w-12 h-10 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <input
                  type="text"
                  value={branding.secondary_color}
                  onChange={(e) => setBranding({ ...branding, secondary_color: e.target.value })}
                  disabled={!features.custom_colors}
                  className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Color Preview */}
          {features.custom_colors && (
            <div className="p-4 bg-gray-700/50 rounded-lg">
              <p className="text-gray-400 text-sm mb-3">Color Preview:</p>
              <div className="flex gap-3">
                <button
                  style={{ backgroundColor: branding.primary_color }}
                  className="px-4 py-2 rounded-lg text-white font-medium"
                >
                  Primary Button
                </button>
                <button
                  style={{ backgroundColor: branding.secondary_color }}
                  className="px-4 py-2 rounded-lg text-white font-medium"
                >
                  Secondary Button
                </button>
              </div>
            </div>
          )}

          {/* Custom Domain */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Custom Domain
                {!features.custom_domain && (
                  <span className="text-xs text-purple-400">(Platinum only)</span>
                )}
              </div>
            </label>
            <input
              type="text"
              value={branding.custom_domain}
              onChange={(e) => setBranding({ ...branding, custom_domain: e.target.value })}
              disabled={!features.custom_domain}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="app.yourdomain.com"
            />
            {features.custom_domain && (
              <p className="text-gray-500 text-xs mt-1">
                Add a CNAME record pointing to platform.botbuilder.com
              </p>
            )}
          </div>

          {/* Save Button */}
          <div className="pt-4">
            <button
              onClick={handleSave}
              disabled={saving || tier === 'silver'}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
