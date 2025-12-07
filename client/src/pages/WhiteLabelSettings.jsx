import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, Upload, Palette, Globe, Mail, FileText, Settings as SettingsIcon, CheckCircle, AlertCircle } from 'lucide-react';
import ColorPicker from '../components/ColorPicker';
import { getSettings, updateSettings, uploadLogo, uploadFavicon } from '../api/whitelabel';
import { useBrand } from '../contexts/BrandContext';

/**
 * White-label Settings Page
 * Allows admins to customize platform branding
 */

export default function WhiteLabelSettings() {
  const { t } = useTranslation();
  const { refreshBrand } = useBrand();

  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    brand_name: '',
    primary_color: '#8b5cf6',
    secondary_color: '#6366f1',
    accent_color: '#ec4899',
    background_color: '#ffffff',
    text_color: '#1f2937',
    custom_domain: '',
    support_email: '',
    company_name: '',
    company_website: '',
    email_from_name: '',
    email_from_address: '',
    email_header_color: '#8b5cf6',
    email_footer_text: '',
    privacy_policy_url: '',
    terms_of_service_url: '',
    show_powered_by: true,
    custom_css: ''
  });

  const [logoFile, setLogoFile] = useState(null);
  const [faviconFile, setFaviconFile] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await getSettings();

      if (response.success && response.settings) {
        setSettings(response.settings);
        setFormData({
          brand_name: response.settings.brand_name || '',
          primary_color: response.settings.primary_color || '#8b5cf6',
          secondary_color: response.settings.secondary_color || '#6366f1',
          accent_color: response.settings.accent_color || '#ec4899',
          background_color: response.settings.background_color || '#ffffff',
          text_color: response.settings.text_color || '#1f2937',
          custom_domain: response.settings.custom_domain || '',
          support_email: response.settings.support_email || '',
          company_name: response.settings.company_name || '',
          company_website: response.settings.company_website || '',
          email_from_name: response.settings.email_from_name || '',
          email_from_address: response.settings.email_from_address || '',
          email_header_color: response.settings.email_header_color || '#8b5cf6',
          email_footer_text: response.settings.email_footer_text || '',
          privacy_policy_url: response.settings.privacy_policy_url || '',
          terms_of_service_url: response.settings.terms_of_service_url || '',
          show_powered_by: response.settings.show_powered_by !== false,
          custom_css: response.settings.custom_css || ''
        });
      }
    } catch (error) {
      // Silent fail
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleColorChange = (colorName, value) => {
    setFormData(prev => ({
      ...prev,
      [colorName]: value
    }));
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploadingLogo(true);
      const response = await uploadLogo(file);

      if (response.success) {
        setMessage({ type: 'success', text: 'Logo uploaded successfully!' });
        await fetchSettings();
        await refreshBrand();
      }
    } catch (error) {
      // Silent fail
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to upload logo' });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleFaviconUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploadingFavicon(true);
      const response = await uploadFavicon(file);

      if (response.success) {
        setMessage({ type: 'success', text: 'Favicon uploaded successfully!' });
        await fetchSettings();
        await refreshBrand();
      }
    } catch (error) {
      // Silent fail
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to upload favicon' });
    } finally {
      setUploadingFavicon(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);
      setMessage(null);

      const response = await updateSettings(formData);

      if (response.success) {
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
        await fetchSettings();
        await refreshBrand();
      }
    } catch (error) {
      // Silent fail
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to save settings'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('whiteLabel.title')}</h1>
        <p className="text-gray-600">
          {t('whiteLabel.subtitle')}
        </p>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Brand Identity Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Palette className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-bold text-gray-900">{t('whiteLabel.brandIdentity')}</h2>
          </div>

          <div className="space-y-6">
            {/* Brand Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('whiteLabel.brandName')}
              </label>
              <input
                type="text"
                name="brand_name"
                value={formData.brand_name}
                onChange={handleInputChange}
                placeholder="BotBuilder"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">
                This name will appear in the page title and navigation
              </p>
            </div>

            {/* Logo Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('whiteLabel.logo')}
              </label>
              {settings?.logo_url && (
                <div className="mb-3">
                  <img
                    src={settings.logo_url}
                    alt="Current logo"
                    className="h-16 object-contain border border-gray-200 rounded p-2"
                  />
                </div>
              )}
              <div className="flex items-center gap-3">
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                  <Upload className="w-4 h-4" />
                  {uploadingLogo ? t('common.uploading') : t('whiteLabel.uploadLogo')}
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.svg"
                    onChange={handleLogoUpload}
                    disabled={uploadingLogo}
                    className="hidden"
                  />
                </label>
                <span className="text-xs text-gray-500">
                  PNG, JPG, SVG (Max 2MB)
                </span>
              </div>
            </div>

            {/* Favicon Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('whiteLabel.favicon')}
              </label>
              {settings?.favicon_url && (
                <div className="mb-3">
                  <img
                    src={settings.favicon_url}
                    alt="Current favicon"
                    className="h-8 w-8 object-contain border border-gray-200 rounded p-1"
                  />
                </div>
              )}
              <div className="flex items-center gap-3">
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                  <Upload className="w-4 h-4" />
                  {uploadingFavicon ? t('common.uploading') : t('whiteLabel.uploadFavicon')}
                  <input
                    type="file"
                    accept=".ico,.png"
                    onChange={handleFaviconUpload}
                    disabled={uploadingFavicon}
                    className="hidden"
                  />
                </label>
                <span className="text-xs text-gray-500">
                  ICO, PNG (Max 1MB)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Color Scheme Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Palette className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-bold text-gray-900">{t('whiteLabel.colorScheme')}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ColorPicker
              label="Primary Color"
              value={formData.primary_color}
              onChange={(value) => handleColorChange('primary_color', value)}
              defaultValue="#8b5cf6"
              description="Main brand color used throughout the platform"
            />

            <ColorPicker
              label="Secondary Color"
              value={formData.secondary_color}
              onChange={(value) => handleColorChange('secondary_color', value)}
              defaultValue="#6366f1"
              description="Secondary accent color"
            />

            <ColorPicker
              label="Accent Color"
              value={formData.accent_color}
              onChange={(value) => handleColorChange('accent_color', value)}
              defaultValue="#ec4899"
              description="Highlights and call-to-action buttons"
            />

            <ColorPicker
              label="Background Color"
              value={formData.background_color}
              onChange={(value) => handleColorChange('background_color', value)}
              defaultValue="#ffffff"
              description="Main background color"
            />

            <ColorPicker
              label="Text Color"
              value={formData.text_color}
              onChange={(value) => handleColorChange('text_color', value)}
              defaultValue="#1f2937"
              description="Primary text color"
            />
          </div>
        </div>

        {/* Custom Domain Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Globe className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-bold text-gray-900">{t('whiteLabel.customDomain')}</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('whiteLabel.customDomain')}
              </label>
              <input
                type="text"
                name="custom_domain"
                value={formData.custom_domain}
                onChange={handleInputChange}
                placeholder="app.yourdomain.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">
                Configure DNS records and contact support to verify your domain
              </p>
            </div>

            {settings?.custom_domain_verified && (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle className="w-4 h-4" />
                <span>Domain verified</span>
              </div>
            )}
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Mail className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-bold text-gray-900">{t('whiteLabel.contactInfo')}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('whiteLabel.supportEmail')}
              </label>
              <input
                type="email"
                name="support_email"
                value={formData.support_email}
                onChange={handleInputChange}
                placeholder="support@yourdomain.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('whiteLabel.companyName')}
              </label>
              <input
                type="text"
                name="company_name"
                value={formData.company_name}
                onChange={handleInputChange}
                placeholder="Your Company Inc."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('whiteLabel.companyWebsite')}
              </label>
              <input
                type="url"
                name="company_website"
                value={formData.company_website}
                onChange={handleInputChange}
                placeholder="https://yourdomain.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Email Branding */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Mail className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-bold text-gray-900">{t('whiteLabel.emailBranding')}</h2>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  From Name
                </label>
                <input
                  type="text"
                  name="email_from_name"
                  value={formData.email_from_name}
                  onChange={handleInputChange}
                  placeholder="Your Company"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  From Email Address
                </label>
                <input
                  type="email"
                  name="email_from_address"
                  value={formData.email_from_address}
                  onChange={handleInputChange}
                  placeholder="noreply@yourdomain.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            <ColorPicker
              label="Email Header Color"
              value={formData.email_header_color}
              onChange={(value) => handleColorChange('email_header_color', value)}
              defaultValue="#8b5cf6"
              description="Header background color in email templates"
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Footer Text
              </label>
              <textarea
                name="email_footer_text"
                value={formData.email_footer_text}
                onChange={handleInputChange}
                rows={3}
                placeholder="© 2025 Your Company. All rights reserved."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Legal Links */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-bold text-gray-900">{t('whiteLabel.legalLinks')}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Privacy Policy URL
              </label>
              <input
                type="url"
                name="privacy_policy_url"
                value={formData.privacy_policy_url}
                onChange={handleInputChange}
                placeholder="https://yourdomain.com/privacy"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Terms of Service URL
              </label>
              <input
                type="url"
                name="terms_of_service_url"
                value={formData.terms_of_service_url}
                onChange={handleInputChange}
                placeholder="https://yourdomain.com/terms"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Advanced Settings */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <SettingsIcon className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-bold text-gray-900">{t('whiteLabel.advancedSettings')}</h2>
          </div>

          <div className="space-y-6">
            {/* Show Powered By */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="show_powered_by"
                name="show_powered_by"
                checked={formData.show_powered_by}
                onChange={handleInputChange}
                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <label htmlFor="show_powered_by" className="text-sm font-medium text-gray-700">
                Show "Powered by BotBuilder" branding
              </label>
            </div>

            {/* Custom CSS */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Custom CSS
              </label>
              <textarea
                name="custom_css"
                value={formData.custom_css}
                onChange={handleInputChange}
                rows={6}
                placeholder=".custom-class { color: red; }"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                Advanced: Inject custom CSS to further customize the platform appearance
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-5 h-5" />
            {saving ? t('common.saving') : t('common.saveSettings')}
          </button>
        </div>
      </form>
    </div>
  );
}
