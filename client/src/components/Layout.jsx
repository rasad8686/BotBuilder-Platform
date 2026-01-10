import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, User, Settings, CreditCard, LogOut } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import Sidebar from './Sidebar';
import DemoBanner from './DemoBanner';
import EmailVerificationBanner from './EmailVerificationBanner';
import { BannerDisplay } from './banners';
import { NotificationCenter } from './notifications';
import Breadcrumb from './Breadcrumb';
import GlobalSearch from './GlobalSearch';
import BottomNavBar from './BottomNavBar';

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
    // Check if user was admin before clearing localStorage
    const wasAdmin = localStorage.getItem('adminToken') ||
                     (user?.isSuperAdmin || user?.is_superadmin);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    navigate(wasAdmin ? '/admin/login' : '/login');
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
      {/* Skip to Content - Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-purple-600 focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
      >
        {t('accessibility.skipToContent', 'Skip to main content')}
      </a>
      <Sidebar />
      {/* Main Content Area - offset for sidebar on desktop */}
      <main className="flex-1 lg:ml-64 transition-all duration-300">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-3 sm:px-6 py-2 sm:py-3 transition-colors duration-300">
          <div className="flex items-center justify-end gap-2 sm:gap-4 ml-12 lg:ml-0">
            {/* Global Search */}
            <GlobalSearch />

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
                        <Check className="w-4 h-4 text-purple-600 dark:text-purple-400" />
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
                className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
                aria-label="User menu"
                aria-expanded={showUserMenu}
                aria-haspopup="true"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  (user?.isSuperAdmin || user?.is_superadmin)
                    ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                    : 'bg-purple-100 dark:bg-purple-900'
                }`}>
                  <span className={`text-sm font-bold ${
                    (user?.isSuperAdmin || user?.is_superadmin)
                      ? 'text-white'
                      : 'text-purple-600 dark:text-purple-300'
                  }`}>
                    {user?.name?.charAt(0)?.toUpperCase() || <User className="w-4 h-4" />}
                  </span>
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200 hidden sm:block">
                  {(user?.isSuperAdmin || user?.is_superadmin)
                    ? t('header.superAdmin')
                    : (user?.name || 'User')
                  }
                </span>
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* User Dropdown Menu */}
              {showUserMenu && (
                <div
                  className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 py-1 z-50"
                  role="menu"
                  aria-label="User menu options"
                >
                  <button
                    onClick={() => { navigate('/settings'); setShowUserMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
                  >
                    <Settings className="w-4 h-4" /> {t('sidebar.settings', 'Settings')}
                  </button>
                  <button
                    onClick={() => { navigate('/billing'); setShowUserMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" /> {t('sidebar.billing', 'Billing')}
                  </button>
                  <hr className="my-1 border-gray-200 dark:border-slate-700" />
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" /> {t('sidebar.logout', 'Logout')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Demo Banner - Shows when in demo mode */}
        <DemoBanner />

        {/* In-App Banners - Priority announcements and notifications */}
        <div className="px-6 pt-4">
          <BannerDisplay />
        </div>

        {/* Email Verification Banner - Shows when email not verified */}
        <div className="px-6 pt-2">
          <EmailVerificationBanner user={user} />
        </div>

        {/* Breadcrumb Navigation */}
        <div className="px-6 pt-4">
          <Breadcrumb />
        </div>

        {/* Main Content with bottom padding for mobile navbar */}
        <div id="main-content" className="pb-20 md:pb-0" tabIndex="-1">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNavBar />
    </div>
  );
}
