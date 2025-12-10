import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import botApi from '../api/bots';

export default function EditBot() {
  useTranslation();
  const { botId } = useParams();
  const [formData, setFormData] = useState({
    name: '',
    platform: 'telegram',
    language: 'en',
    description: '',
    webhook_url: '',
    is_active: true
  });

  // 50+ supported languages with flags
  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
    { code: 'az', name: 'Azərbaycan', flag: '🇦🇿' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'ka', name: 'ქართული', flag: '🇬🇪' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
    { code: 'ko', name: '한국어', flag: '🇰🇷' },
    { code: 'pt', name: 'Português', flag: '🇵🇹' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
    { code: 'pl', name: 'Polski', flag: '🇵🇱' },
    { code: 'uk', name: 'Українська', flag: '🇺🇦' },
    { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
    { code: 'bn', name: 'বাংলা', flag: '🇧🇩' },
    { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' },
    { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
    { code: 'th', name: 'ไทย', flag: '🇹🇭' },
    { code: 'el', name: 'Ελληνικά', flag: '🇬🇷' },
    { code: 'cs', name: 'Čeština', flag: '🇨🇿' },
    { code: 'ro', name: 'Română', flag: '🇷🇴' },
    { code: 'hu', name: 'Magyar', flag: '🇭🇺' },
    { code: 'sv', name: 'Svenska', flag: '🇸🇪' },
    { code: 'fi', name: 'Suomi', flag: '🇫🇮' },
    { code: 'da', name: 'Dansk', flag: '🇩🇰' },
    { code: 'no', name: 'Norsk', flag: '🇳🇴' },
    { code: 'he', name: 'עברית', flag: '🇮🇱' },
    { code: 'fa', name: 'فارسی', flag: '🇮🇷' },
    { code: 'ms', name: 'Bahasa Melayu', flag: '🇲🇾' },
    { code: 'tl', name: 'Filipino', flag: '🇵🇭' },
    { code: 'sw', name: 'Kiswahili', flag: '🇰🇪' },
    { code: 'ur', name: 'اردو', flag: '🇵🇰' },
    { code: 'ta', name: 'தமிழ்', flag: '🇮🇳' },
    { code: 'te', name: 'తెలుగు', flag: '🇮🇳' },
    { code: 'mr', name: 'मराठी', flag: '🇮🇳' },
    { code: 'gu', name: 'ગુજરાતી', flag: '🇮🇳' },
    { code: 'kn', name: 'ಕನ್ನಡ', flag: '🇮🇳' },
    { code: 'ml', name: 'മലയാളം', flag: '🇮🇳' },
    { code: 'pa', name: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
    { code: 'bg', name: 'Български', flag: '🇧🇬' },
    { code: 'hr', name: 'Hrvatski', flag: '🇭🇷' },
    { code: 'sk', name: 'Slovenčina', flag: '🇸🇰' },
    { code: 'sl', name: 'Slovenščina', flag: '🇸🇮' },
    { code: 'sr', name: 'Српски', flag: '🇷🇸' },
    { code: 'lt', name: 'Lietuvių', flag: '🇱🇹' },
    { code: 'lv', name: 'Latviešu', flag: '🇱🇻' },
    { code: 'et', name: 'Eesti', flag: '🇪🇪' },
    { code: 'ca', name: 'Català', flag: '🇪🇸' },
    { code: 'eu', name: 'Euskara', flag: '🇪🇸' },
    { code: 'gl', name: 'Galego', flag: '🇪🇸' },
    { code: 'cy', name: 'Cymraeg', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿' },
    { code: 'ga', name: 'Gaeilge', flag: '🇮🇪' },
    { code: 'is', name: 'Íslenska', flag: '🇮🇸' },
    { code: 'kk', name: 'Қазақша', flag: '🇰🇿' },
    { code: 'uz', name: 'Oʻzbek', flag: '🇺🇿' },
    { code: 'ky', name: 'Кыргызча', flag: '🇰🇬' },
    { code: 'mn', name: 'Монгол', flag: '🇲🇳' },
    { code: 'ne', name: 'नेपाली', flag: '🇳🇵' },
    { code: 'si', name: 'සිංහල', flag: '🇱🇰' },
    { code: 'km', name: 'ខ្មែរ', flag: '🇰🇭' },
    { code: 'lo', name: 'ລາວ', flag: '🇱🇦' },
    { code: 'my', name: 'မြန်မာ', flag: '🇲🇲' },
    { code: 'am', name: 'አማርኛ', flag: '🇪🇹' },
    { code: 'auto', name: 'Auto-detect', flag: '🌐' }
  ];
  const [apiToken, setApiToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    fetchBot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId]);

  const fetchBot = async () => {
    try {
      setLoading(true);
      const response = await botApi.getBot(botId);
      const bot = response.bot || response;

      setFormData({
        name: bot.name || '',
        platform: bot.platform || 'telegram',
        language: bot.language || 'en',
        description: bot.description || '',
        webhook_url: bot.webhook_url || '',
        is_active: bot.is_active !== undefined ? bot.is_active : true
      });
      setApiToken(bot.api_token || '');
      setError('');
    } catch (err) {
      // Silent fail
      setError(err.response?.data?.message || 'Failed to load bot details');
    } finally {
      setLoading(false);
    }
  };

  // Validate form
  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim()) {
      errors.name = 'Bot name is required';
    } else if (formData.name.length > 255) {
      errors.name = 'Bot name must be less than 255 characters';
    }

    if (!formData.platform) {
      errors.platform = 'Platform is required';
    }

    if (formData.webhook_url && !isValidUrl(formData.webhook_url)) {
      errors.webhook_url = 'Please enter a valid URL';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // URL validation
  const isValidUrl = (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // Copy API token to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('API token copied to clipboard!');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!validateForm()) {
      return;
    }

    setSaving(true);

    try {
      // Prepare update data
      const updateData = { ...formData };

      // Remove empty webhook_url if not provided
      if (!updateData.webhook_url.trim()) {
        updateData.webhook_url = null;
      }

      // Remove empty description if not provided
      if (!updateData.description.trim()) {
        updateData.description = null;
      }

      await botApi.updateBot(botId, updateData);
      setSuccess(true);

      // Redirect after short delay
      setTimeout(() => {
        navigate('/mybots');
      }, 1500);
    } catch (err) {
      // Silent fail
      setError(
        err.response?.data?.message ||
        err.message ||
        'Failed to update bot'
      );
    } finally {
      setSaving(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">⏳</div>
          <div className="text-xl text-gray-600">Loading bot details...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <Link
          to="/mybots"
          className="inline-flex items-center text-purple-600 hover:text-purple-700 font-medium mb-4"
        >
          ← Back to My Bots
        </Link>

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            Edit Bot ✏️
          </h1>
          <p className="text-gray-600">
            Update your bot's information and settings
          </p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
            ✅ Bot updated successfully! Redirecting...
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            ⚠️ {error}
          </div>
        )}

        {/* Form */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Bot Name */}
            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Bot Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  fieldErrors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., Customer Support Bot"
                maxLength={255}
              />
              {fieldErrors.name && (
                <p className="text-red-500 text-sm mt-1">{fieldErrors.name}</p>
              )}
            </div>

            {/* Platform */}
            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Platform <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.platform}
                onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  fieldErrors.platform ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="telegram">✈️ Telegram</option>
                <option value="whatsapp">💬 WhatsApp</option>
                <option value="discord">🎮 Discord</option>
                <option value="slack">💼 Slack</option>
                <option value="messenger">💌 Facebook Messenger</option>
              </select>
              {fieldErrors.platform && (
                <p className="text-red-500 text-sm mt-1">{fieldErrors.platform}</p>
              )}
            </div>

            {/* Language */}
            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Bot Language
              </label>
              <select
                value={formData.language}
                onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.name}
                  </option>
                ))}
              </select>
              <p className="text-gray-500 text-sm mt-1">
                Select the language for bot responses. Use "Auto-detect" to automatically detect user's language.
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows="4"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Describe what your bot does..."
              />
              <p className="text-gray-500 text-sm mt-1">Optional</p>
            </div>

            {/* Webhook URL */}
            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Webhook URL
              </label>
              <input
                type="url"
                value={formData.webhook_url}
                onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  fieldErrors.webhook_url ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="https://your-domain.com/webhook"
              />
              {fieldErrors.webhook_url && (
                <p className="text-red-500 text-sm mt-1">{fieldErrors.webhook_url}</p>
              )}
              <p className="text-gray-500 text-sm mt-1">
                Optional - URL to receive bot event notifications
              </p>
            </div>

            {/* Active Status Toggle */}
            <div>
              <label className="flex items-center justify-between p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <div>
                  <span className="text-gray-700 font-semibold">Active Status</span>
                  <p className="text-sm text-gray-500">
                    {formData.is_active ? 'Bot is currently active' : 'Bot is currently inactive'}
                  </p>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="sr-only"
                  />
                  <div className={`w-14 h-8 rounded-full transition-colors ${
                    formData.is_active ? 'bg-green-500' : 'bg-gray-300'
                  }`}>
                    <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out mt-1 ${
                      formData.is_active ? 'translate-x-7 ml-1' : 'translate-x-1'
                    }`} />
                  </div>
                </div>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Saving...
                  </>
                ) : (
                  <>
                    💾 Save Changes
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => navigate('/mybots')}
                className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>

        {/* API Token Display (Read-Only) */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">API Token</h2>
          <p className="text-gray-600 mb-4">
            Use this token to authenticate API requests for this bot. Keep it secure!
          </p>

          <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white px-3 py-2 rounded border border-gray-300 text-sm break-all font-mono">
                {apiToken || 'No token available'}
              </code>
              {apiToken && (
                <button
                  onClick={() => copyToClipboard(apiToken)}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors whitespace-nowrap"
                >
                  📋 Copy
                </button>
              )}
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
            <p className="text-sm text-yellow-800">
              ⚠️ <strong>Note:</strong> API tokens cannot be changed. If you suspect your token has been compromised, please delete and recreate the bot.
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-6 space-y-3">
          <button
            onClick={() => navigate(`/bots/${botId}/ai-config`)}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-md flex items-center justify-center gap-2"
          >
            🤖 Configure AI Settings
          </button>
          <button
            onClick={() => navigate(`/bot/${botId}/messages`)}
            className="w-full bg-green-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-700 transition-colors shadow-md flex items-center justify-center gap-2"
          >
            💬 Manage Bot Messages
          </button>
          <button
            onClick={() => navigate(`/bots/${botId}/flow`)}
            className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 transition-colors shadow-md flex items-center justify-center gap-2"
          >
            🔀 Edit Flow Builder
          </button>
        </div>
      </div>
    </div>
  );
}
