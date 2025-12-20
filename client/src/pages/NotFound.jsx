import { useTranslation } from 'react-i18next';
import { Home } from 'lucide-react';

/**
 * NotFound Page (404)
 * Displayed when user navigates to a non-existent route
 */
const NotFound = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <span className="text-2xl font-bold text-gray-900">BotBuilder</span>
        </div>
      </div>

      {/* Error Card */}
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        {/* 404 Icon */}
        <div className="text-8xl font-bold text-indigo-600 mb-4">404</div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          {t('notFound.title')}
        </h1>

        {/* Message */}
        <p className="text-gray-600 mb-8">
          {t('notFound.message')}
        </p>

        {/* Home Button */}
        <a
          href="/"
          className="inline-flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
        >
          <Home className="w-5 h-5" />
          {t('notFound.button')}
        </a>
      </div>
    </div>
  );
};

export default NotFound;
