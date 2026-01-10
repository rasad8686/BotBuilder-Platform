import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Bot, AlertTriangle, Loader2, Rocket, PartyPopper, Copy
} from 'lucide-react';
import botApi from '../api/bots';
import UpgradeLimitModal from '../components/UpgradeLimitModal';

export default function CreateBot() {
  useTranslation();
  const [formData, setFormData] = useState({
    name: '',
    platform: 'telegram',
    language: 'en',
    description: '',
    webhook_url: ''
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
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const navigate = useNavigate();

  // Plan limit modal state
  const [upgradeLimitModalOpen, setUpgradeLimitModalOpen] = useState(false);
  const [limitErrorData, setLimitErrorData] = useState(null);

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

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Remove empty webhook_url if not provided
      const submitData = { ...formData };
      if (!submitData.webhook_url.trim()) {
        delete submitData.webhook_url;
      }
      if (!submitData.description.trim()) {
        delete submitData.description;
      }

      const response = await botApi.createBot(submitData);

      // Show API token modal
      if (response.success && response.bot) {
        setApiToken(response.bot.api_token);
        setShowTokenModal(true);
      }
    } catch (err) {
      // Silent fail

      // Check if this is a plan limit error
      if (err.response?.data?.limitReached) {
        setLimitErrorData(err.response.data);
        setUpgradeLimitModalOpen(true);
      } else {
        setError(
          err.response?.data?.message ||
          err.message ||
          'Failed to create bot. Please try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Close modal and navigate
  const handleCloseTokenModal = () => {
    setShowTokenModal(false);
    navigate('/mybots', { state: { botCreated: true } });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-8 px-4 transition-colors duration-300">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <Link
          to="/mybots"
          className="inline-flex items-center text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium mb-4"
        >
          ← Back to My Bots
        </Link>

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
            Create New Bot <Bot className="w-7 h-7 text-purple-600" />
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Fill in the details below to create your chatbot
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> {error}
          </div>
        )}

        {/* Form */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 transition-colors duration-300">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Bot Name */}
            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-2">
                Bot Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:text-white ${
                  fieldErrors.name ? 'border-red-500' : 'border-gray-300 dark:border-slate-600'
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
              <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-2">
                Platform <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.platform}
                onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:text-white ${
                  fieldErrors.platform ? 'border-red-500' : 'border-gray-300 dark:border-slate-600'
                }`}
              >
                <option value="telegram">Telegram</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="discord">Discord</option>
                <option value="slack">Slack</option>
                <option value="messenger">Facebook Messenger</option>
              </select>
              {fieldErrors.platform && (
                <p className="text-red-500 text-sm mt-1">{fieldErrors.platform}</p>
              )}
            </div>

            {/* Language */}
            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-2">
                Bot Language
              </label>
              <select
                value={formData.language}
                onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:text-white"
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.name}
                  </option>
                ))}
              </select>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                Select the language for bot responses. Use "Auto-detect" to automatically detect user's language.
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows="4"
                className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:text-white"
                placeholder="Describe what your bot does..."
              />
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Optional</p>
            </div>

            {/* Webhook URL */}
            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-2">
                Webhook URL
              </label>
              <input
                type="url"
                value={formData.webhook_url}
                onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:text-white ${
                  fieldErrors.webhook_url ? 'border-red-500' : 'border-gray-300 dark:border-slate-600'
                }`}
                placeholder="https://your-domain.com/webhook"
              />
              {fieldErrors.webhook_url && (
                <p className="text-red-500 text-sm mt-1">{fieldErrors.webhook_url}</p>
              )}
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                Optional - URL to receive bot event notifications
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Rocket className="w-5 h-5" /> Create Bot
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* API Token Modal */}
      {showTokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black bg-opacity-50" />

          {/* Modal */}
          <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full p-6">
            <div className="text-center mb-4">
              <div className="flex justify-center mb-2">
                <PartyPopper className="w-12 h-12 text-purple-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Bot Created Successfully!
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Save your API token now - you won't be able to see it again!
              </p>
            </div>

            {/* API Token Display */}
            <div className="bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg p-4 mb-4">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                API Token
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white dark:bg-slate-800 px-3 py-2 rounded border border-gray-300 dark:border-slate-600 text-sm break-all dark:text-gray-200">
                  {apiToken}
                </code>
                <button
                  onClick={() => copyToClipboard(apiToken)}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors whitespace-nowrap flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" /> Copy
                </button>
              </div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 mb-4 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800 dark:text-yellow-400">
                <strong>Important:</strong> Store this token securely. You'll need it to authenticate API requests for this bot.
              </p>
            </div>

            <button
              onClick={handleCloseTokenModal}
              className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
            >
              Continue to My Bots
            </button>
          </div>
        </div>
      )}

      {/* Upgrade Limit Modal */}
      <UpgradeLimitModal
        isOpen={upgradeLimitModalOpen}
        onClose={() => setUpgradeLimitModalOpen(false)}
        limitData={limitErrorData}
      />
    </div>
  );
}
