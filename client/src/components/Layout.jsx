import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import Sidebar from './Sidebar';
import DemoBanner from './DemoBanner';
import EmailVerificationBanner from './EmailVerificationBanner';
import Footer from './Footer';
import { NotificationCenter } from './notifications';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function Layout({ children }) {
  const { t } = useTranslation();
  const { currentLanguage, changeLanguage } = useLanguage();
  const [user, setUser] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const userMenuRef = useRef(null);
  const langMenuRef = useRef(null);
  const navigate = useNavigate();

  const languages = [
    { code: 'en', flag: '🇬🇧', name: 'English' },
    { code: 'tr', flag: '🇹🇷', name: 'Türkçe' },
    { code: 'ru', flag: '🇷🇺', name: 'Русский' },
    { code: 'az', flag: '🇦🇿', name: 'Azərbaycan' }
  ];

  const currentLang = languages.find(l => l.code === currentLanguage) || languages[0];

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);

        // Check verification status from backend
        checkVerificationStatus(parsedUser.email);
      } catch (e) {
        // Silent fail
      }
    }
  }, []);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
      if (langMenuRef.current && !langMenuRef.current.contains(event.target)) {
        setShowLangMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const checkVerificationStatus = async (email) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();

      // If already verified, update localStorage and state
      if (data.alreadyVerified) {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          userData.isVerified = true;
          localStorage.setItem('user', JSON.stringify(userData));
          setUser(userData);
        }
      }
    } catch (e) {
      // Silent fail - don't block UI
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
      <Sidebar />
      {/* Main Content Area - offset for sidebar on desktop */}
      <main className="flex-1 lg:ml-64 transition-all duration-300">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-3 sm:px-6 py-2 sm:py-3 transition-colors duration-300">
          <div className="flex items-center justify-end gap-2 sm:gap-4 ml-12 lg:ml-0">
            {/* Language Selector */}
            <div className="relative" ref={langMenuRef}>
              <button
                onClick={() => setShowLangMenu(!showLangMenu)}
                className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors text-sm font-bold text-gray-700 dark:text-gray-300"
              >
                {currentLanguage.toUpperCase()}
              </button>

              {showLangMenu && (
                <div className="absolute right-0 top-full mt-2 w-28 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 py-1 z-50">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        changeLanguage(lang.code);
                        setShowLangMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors ${
                        currentLanguage === lang.code ? 'bg-purple-50 dark:bg-purple-900/30' : ''
                      }`}
                    >
                      <span className={`text-sm font-semibold ${currentLanguage === lang.code ? 'text-purple-600 dark:text-purple-400' : 'text-gray-700 dark:text-gray-300'}`}>
                        {lang.code.toUpperCase()}
                      </span>
                      {currentLanguage === lang.code && (
                        <span className="text-purple-600 dark:text-purple-400">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Notification Center */}
            <NotificationCenter />

            {/* User Info with Dropdown */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                  <span className="text-purple-600 dark:text-purple-300 text-sm font-medium">
                    {user?.name?.charAt(0)?.toUpperCase() || '👤'}
                  </span>
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200 hidden sm:block">
                  {user?.name || 'User'}
                </span>
              </button>

              {/* User Dropdown Menu */}
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 py-1 z-50">
                  <button
                    onClick={() => { navigate('/settings'); setShowUserMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    ⚙️ {t('sidebar.settings', 'Settings')}
                  </button>
                  <button
                    onClick={() => { navigate('/billing'); setShowUserMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    💳 {t('sidebar.billing', 'Billing')}
                  </button>
                  <hr className="my-1 border-gray-200 dark:border-slate-700" />
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    🚪 {t('sidebar.logout', 'Logout')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Demo Banner - Shows when in demo mode */}
        <DemoBanner />

        {/* Email Verification Banner - Shows when email not verified */}
        <div className="px-6 pt-4">
          <EmailVerificationBanner user={user} />
        </div>

        {children}
        <Footer />
      </main>
    </div>
  );
}
