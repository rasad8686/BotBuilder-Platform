import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';

export default function Sidebar() {
  const [user, setUser] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentLanguage, changeLanguage, languages } = useLanguage();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (e) {
        console.error('Error parsing user data:', e);
      }
    }
  }, []);

  const handleLogout = () => {
    if (confirm(t('sidebar.logoutConfirm'))) {
      localStorage.clear();
      navigate('/login');
    }
  };

  const navLinks = [
    { path: '/dashboard', icon: '🏠', label: t('sidebar.dashboard') },
    { path: '/mybots', icon: '🤖', label: t('sidebar.myBots') },
    { path: '/billing', icon: '💳', label: t('sidebar.billing') },
    { path: '/api-tokens', icon: '🔑', label: t('sidebar.apiTokens') },
    { path: '/webhooks', icon: '🔗', label: t('sidebar.webhooks') },
    { path: '/usage', icon: '📊', label: t('sidebar.usage') },
    { path: '/settings', icon: '⚙️', label: t('sidebar.settings') },
  ];

  const currentLang = languages.find(lang => lang.code === currentLanguage);

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-purple-600 text-white p-3 rounded-lg shadow-lg hover:bg-purple-700"
      >
        {isMobileMenuOpen ? '✕' : '☰'}
      </button>

      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-screen w-64 bg-white shadow-xl z-40
          flex flex-col transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        {/* Logo/Brand */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-3xl">🤖</div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-800">{t('sidebar.brand')}</h1>
                  <span className="text-[10px] font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded">
                    BETA
                  </span>
                </div>
                <p className="text-xs text-gray-500">{t('sidebar.platform')}</p>
              </div>
            </div>

            {/* Language Selector */}
            <div className="relative">
              <button
                onClick={() => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {currentLang?.isText ? (
                  <span className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-1 rounded">
                    {currentLang.flag}
                  </span>
                ) : (
                  <span className="text-xl">{currentLang?.flag}</span>
                )}
              </button>

              {/* Language Dropdown */}
              {isLanguageDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsLanguageDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-20">
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          changeLanguage(lang.code);
                          setIsLanguageDropdownOpen(false);
                        }}
                        className={`
                          w-full px-4 py-2 text-left flex items-center gap-3
                          hover:bg-purple-50 transition-colors
                          ${currentLanguage === lang.code ? 'bg-purple-100 text-purple-700' : 'text-gray-700'}
                        `}
                      >
                        {lang.isText ? (
                          <span className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-1 rounded min-w-[2rem] text-center">
                            {lang.flag}
                          </span>
                        ) : (
                          <span className="text-xl">{lang.flag}</span>
                        )}
                        <span className="font-medium">{lang.name}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-2">
            {navLinks.map((link) => (
              <li key={link.path}>
                <Link
                  to={link.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg
                    transition-all duration-200
                    ${
                      isActive(link.path)
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'text-gray-700 hover:bg-purple-50 hover:text-purple-600'
                    }
                  `}
                >
                  <span className="text-xl">{link.icon}</span>
                  <span className="font-medium">{link.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-gray-200">
          {user && (
            <div className="mb-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  {user.name && (
                    <div className="text-sm font-semibold text-gray-800 truncate">
                      {user.name}
                    </div>
                  )}
                  <div className="text-xs text-gray-600 truncate">
                    {user.email}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Send Feedback Button */}
          <button
            onClick={() => window.open('mailto:feedback@botbuilder.com?subject=BotBuilder Beta Feedback', '_blank')}
            className="w-full px-4 py-2.5 mb-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200 font-medium flex items-center justify-center gap-2 text-sm"
          >
            <span>💬</span>
            <span>{t('sidebar.sendFeedback')}</span>
          </button>

          <button
            onClick={handleLogout}
            className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 font-medium flex items-center justify-center gap-2"
          >
            <span>🚪</span>
            <span>{t('sidebar.logout')}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
