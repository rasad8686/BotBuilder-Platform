import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { useBrand } from '../contexts/BrandContext';
import { useTheme } from '../contexts/ThemeContext';
import OrganizationSwitcher from './OrganizationSwitcher';
import FeedbackModal from './FeedbackModal';
import ThemeToggle from './ThemeToggle';

export default function Sidebar() {
  const [user, setUser] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentLanguage, changeLanguage, languages } = useLanguage();
  const { userRole } = useOrganization();
  const { brand } = useBrand();
  const { isDark } = useTheme();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (e) {
        // Error parsing user data
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
    { path: '/organizations/settings', icon: '🏢', label: t('sidebar.organization') },
    { path: '/team', icon: '👥', label: t('sidebar.team') },
    { path: '/settings', icon: '⚙️', label: t('sidebar.settings') },
  ];

  // Multi-Agent AI links (shown in bot context)
  const agentLinks = [
    { path: '/ai-flow', icon: '🤖', label: t('sidebar.aiFlowStudio') },
    { path: '/agent-studio', icon: '🎯', label: t('sidebar.agentStudio') },
    { path: '/autonomous-agents', icon: '🦾', label: t('sidebar.autonomousAgents', 'Autonomous Agents') },
    { path: '/workflows', icon: '🔄', label: t('sidebar.workflows') },
    { path: '/intents', icon: '🎯', label: t('sidebar.intentBuilder') },
    { path: '/orchestrations', icon: '🔀', label: t('sidebar.multiFlow') },
    { path: '/executions', icon: '📋', label: t('sidebar.executions') },
    { path: '/knowledge', icon: '🧠', label: t('sidebar.knowledgeBase') },
    { path: '/channels', icon: '📱', label: t('sidebar.channels') },
    { path: '/integrations', icon: '🔌', label: t('sidebar.integrations', 'Integrations') },
    { path: '/marketplace', icon: '🧩', label: t('sidebar.marketplace') },
  ];

  // Get botId from URL if on a bot-specific page
  const botIdMatch = location.pathname.match(/\/bots\/(\d+)/);
  const currentBotId = botIdMatch ? botIdMatch[1] : null;

  // Admin links - only shown to admins and owners
  const adminLinks = [
    { path: '/admin/dashboard', icon: '📊', label: t('sidebar.adminDashboard') },
    { path: '/admin/audit-logs', icon: '📋', label: t('sidebar.auditLogs') },
    { path: '/admin/health', icon: '🔧', label: t('sidebar.systemHealth') },
    { path: '/admin/whitelabel', icon: '🎨', label: t('sidebar.whiteLabelSettings') },
  ];

  const isAdmin = userRole === 'admin' || userRole === 'owner';

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
          fixed top-0 left-0 h-screen w-64 bg-white dark:bg-slate-900 shadow-xl z-40
          flex flex-col transition-all duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        {/* Logo/Brand */}
        <div className="p-6 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {brand?.logo_url ? (
                <img
                  src={brand.logo_url}
                  alt={brand.brand_name || 'Logo'}
                  className="h-10 w-10 object-contain"
                />
              ) : (
                <div className="text-3xl">🤖</div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-800 dark:text-white">
                    {brand?.brand_name || t('sidebar.brand')}
                  </h1>
                  <span className="text-[10px] font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                    BETA
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('sidebar.platform')}</p>
              </div>
            </div>

          </div>
        </div>

        {/* Organization Switcher */}
        <OrganizationSwitcher />

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
                        : 'text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-slate-800 hover:text-purple-600 dark:hover:text-purple-400'
                    }
                  `}
                >
                  <span className="text-xl">{link.icon}</span>
                  <span className="font-medium">{link.label}</span>
                </Link>
              </li>
            ))}

            {/* Multi-Agent AI Section */}
            <li className="pt-4 pb-2">
              <div className="flex items-center gap-2 px-4">
                <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700"></div>
                <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                  {t('sidebar.aiAgents')}
                </span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700"></div>
              </div>
            </li>
            {agentLinks.map((link) => (
              <li key={link.path}>
                <Link
                  to={link.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg
                    transition-all duration-200
                    ${
                      isActive(link.path)
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-slate-800 hover:text-purple-600 dark:hover:text-purple-400'
                    }
                  `}
                >
                  <span className="text-xl">{link.icon}</span>
                  <span className="font-medium">{link.label}</span>
                </Link>
              </li>
            ))}

            {/* Bot-specific links - shown when on a bot page */}
            {currentBotId && (
              <>
                <li>
                  <Link
                    to={`/bots/${currentBotId}/orchestrations`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-lg
                      transition-all duration-200
                      ${
                        location.pathname.includes('/orchestrations')
                          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                          : 'text-gray-700 hover:bg-purple-50 hover:text-purple-600'
                      }
                    `}
                  >
                    <span className="text-xl">🔀</span>
                    <span className="font-medium">{t('sidebar.multiFlow')}</span>
                  </Link>
                </li>
                <li>
                  <Link
                    to={`/bots/${currentBotId}/tools`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-lg
                      transition-all duration-200
                      ${
                        location.pathname.includes('/tools')
                          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                          : 'text-gray-700 hover:bg-purple-50 hover:text-purple-600'
                      }
                    `}
                  >
                    <span className="text-xl">🔧</span>
                    <span className="font-medium">{t('sidebar.tools')}</span>
                  </Link>
                </li>
                <li>
                  <Link
                    to={`/bots/${currentBotId}/intents`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-lg
                      transition-all duration-200
                      ${
                        location.pathname.includes('/intents')
                          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                          : 'text-gray-700 hover:bg-purple-50 hover:text-purple-600'
                      }
                    `}
                  >
                    <span className="text-xl">🎯</span>
                    <span className="font-medium">{t('sidebar.intentBuilder')}</span>
                  </Link>
                </li>
              </>
            )}

            {/* Admin Section - Only visible to admins */}
            {isAdmin && (
              <>
                <li className="pt-4 pb-2">
                  <div className="flex items-center gap-2 px-4">
                    <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700"></div>
                    <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                      {t('sidebar.admin')}
                    </span>
                    <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700"></div>
                  </div>
                </li>
                {adminLinks.map((link) => (
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
                            : 'text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-slate-800 hover:text-purple-600 dark:hover:text-purple-400'
                        }
                      `}
                    >
                      <span className="text-xl">{link.icon}</span>
                      <span className="font-medium">{link.label}</span>
                    </Link>
                  </li>
                ))}
              </>
            )}
          </ul>
        </nav>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-gray-200 dark:border-slate-700">
          {user && (
            <div className="mb-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  {user.name && (
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold text-gray-800 dark:text-white truncate">
                        {user.name}
                      </div>
                      {isAdmin && (
                        <span className="text-[10px] font-bold text-purple-600 bg-purple-100 dark:bg-purple-900 dark:text-purple-300 px-1.5 py-0.5 rounded">
                          ADMIN
                        </span>
                      )}
                    </div>
                  )}
                  <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {user.email}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Send Feedback Button */}
          <button
            onClick={() => setIsFeedbackModalOpen(true)}
            className="w-full px-4 py-2.5 mb-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200 font-medium flex items-center justify-center gap-2 text-sm"
          >
            <span>💬</span>
            <span>{t('sidebar.sendFeedback')}</span>
          </button>

          {/* Theme Toggle */}
          <div className="flex items-center justify-between px-3 py-2.5 mb-3 bg-gray-100 dark:bg-slate-800 rounded-lg">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {isDark ? '🌙 Dark Mode' : '☀️ Light Mode'}
            </span>
            <ThemeToggle />
          </div>

          <button
            onClick={handleLogout}
            className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 font-medium flex items-center justify-center gap-2"
          >
            <span>🚪</span>
            <span>{t('sidebar.logout')}</span>
          </button>
        </div>
      </aside>

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        userName={user?.username || ''}
        userEmail={user?.email || ''}
      />
    </>
  );
}
