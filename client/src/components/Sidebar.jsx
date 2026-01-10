import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useOrganization } from '../contexts/OrganizationContext';
import { useBrand } from '../contexts/BrandContext';
import { useTheme } from '../contexts/ThemeContext';
import OrganizationSwitcher from './OrganizationSwitcher';
import FeedbackModal from './FeedbackModal';
import ThemeToggle from './ThemeToggle';
import {
  Home, Bot, CreditCard, Key, Link2, BarChart3, Building2, Users, Settings, Shield, KeyRound,
  BookOpen, Gamepad2, GraduationCap, Cpu, Target, Workflow, Shuffle, ClipboardList, Brain,
  Smartphone, Plug, Phone, PhoneCall, UserCircle, Mic, Puzzle, Sparkles, TrendingUp,
  ShoppingCart, Heart, LayoutDashboard, FileText, Wrench, Palette, ShieldCheck, UserCog,
  Crown, Menu, X, LogOut, MessageSquare, Moon, Sun, Compass, FlaskConical, Ticket, PlusCircle,
  Mail, ListFilter, Send, Zap, FileQuestion, LayoutTemplate, Megaphone, Smartphone as SmsIcon
} from 'lucide-react';

export default function Sidebar() {
  const [user, setUser] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { userRole } = useOrganization();
  const { brand } = useBrand();
  const { isDark } = useTheme();

  // Check superadmin status
  useEffect(() => {
    const checkSuperadmin = () => {
      // First check localStorage (faster, no API call needed)
      const adminUserStr = localStorage.getItem('adminUser');
      const userStr = localStorage.getItem('user');

      if (adminUserStr) {
        try {
          const adminUser = JSON.parse(adminUserStr);
          if (adminUser.isSuperAdmin || adminUser.is_superadmin) {
            setIsSuperAdmin(true);
            return;
          }
        } catch (e) {
          // Error parsing
        }
      }

      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          if (user.isSuperAdmin || user.is_superadmin) {
            setIsSuperAdmin(true);
            return;
          }
        } catch (e) {
          // Error parsing
        }
      }
    };
    checkSuperadmin();
  }, []);

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
      // Check if user was superadmin before clearing localStorage
      const wasAdmin = isSuperAdmin || localStorage.getItem('adminToken');
      localStorage.clear();
      navigate(wasAdmin ? '/admin/login' : '/login');
    }
  };

  const navLinks = [
    { path: '/dashboard', icon: Home, label: t('sidebar.dashboard') },
    { path: '/mybots', icon: Bot, label: t('sidebar.myBots') },
    { path: '/billing', icon: CreditCard, label: t('sidebar.billing') },
    { path: '/api-tokens', icon: Key, label: t('sidebar.apiTokens') },
    { path: '/webhooks', icon: Link2, label: t('sidebar.webhooks') },
    { path: '/usage', icon: BarChart3, label: t('sidebar.usage') },
    { path: '/organizations/settings', icon: Building2, label: t('sidebar.organization') },
    { path: '/team', icon: Users, label: t('sidebar.team') },
    { path: '/settings', icon: Settings, label: t('sidebar.settings') },
    { path: '/settings/security', icon: Shield, label: t('sidebar.security', 'Security') },
    { path: '/settings/sso', icon: KeyRound, label: t('sidebar.sso', 'Enterprise SSO') },
    { path: '/docs', icon: BookOpen, label: t('sidebar.documentation', 'Documentation') },
    { path: '/playground', icon: Gamepad2, label: t('sidebar.playground', 'API Playground') },
    { path: '/academy', icon: GraduationCap, label: t('sidebar.tutorials', 'Tutorials') },
  ];

  // Multi-Agent AI links (shown in bot context)
  const agentLinks = [
    { path: '/ai-flow', icon: Cpu, label: t('sidebar.aiFlowStudio') },
    { path: '/agent-studio', icon: Target, label: t('sidebar.agentStudio') },
    { path: '/autonomous-agents', icon: Bot, label: t('sidebar.autonomousAgents', 'Autonomous Agents') },
    { path: '/workflows', icon: Workflow, label: t('sidebar.workflows') },
    { path: '/intents', icon: Target, label: t('sidebar.intentBuilder') },
    { path: '/orchestrations', icon: Shuffle, label: t('sidebar.multiFlow') },
    { path: '/executions', icon: ClipboardList, label: t('sidebar.executions') },
    { path: '/knowledge', icon: Brain, label: t('sidebar.knowledgeBase') },
    { path: '/channels', icon: Smartphone, label: t('sidebar.channels') },
    { path: '/integrations', icon: Plug, label: t('sidebar.integrations', 'Integrations') },
    { path: '/voice-bots', icon: Phone, label: t('sidebar.voiceBots', 'Voice AI') },
    { path: '/call-history', icon: PhoneCall, label: t('sidebar.callHistory', 'Call History') },
    { path: '/work-clone', icon: UserCircle, label: t('sidebar.workClone', 'Work Clone') },
    { path: '/voice-to-bot', icon: Mic, label: t('sidebar.voiceToBot', 'Voice to Bot') },
    { path: '/marketplace', icon: Puzzle, label: t('sidebar.marketplace') },
    { path: '/fine-tuning', icon: Sparkles, label: t('sidebar.fineTuning', 'AI Fine-tuning') },
    { path: '/tours', icon: Compass, label: t('sidebar.productTours', 'Product Tours') },
    { path: '/ab-tests', icon: FlaskConical, label: t('sidebar.abTesting', 'A/B Testing') },
  ];

  // Recovery Engine links
  const recoveryLinks = [
    { path: '/recovery', icon: TrendingUp, label: t('recovery.dashboard') },
    { path: '/recovery/campaigns', icon: Target, label: t('recovery.campaigns') },
    { path: '/recovery/carts', icon: ShoppingCart, label: t('recovery.abandonedCarts') },
    { path: '/recovery/customers', icon: Heart, label: t('recovery.customerHealth') },
  ];

  // Helpdesk/Tickets links
  const helpdeskLinks = [
    { path: '/tickets', icon: Ticket, label: t('tickets.allTickets', 'All Tickets') },
    { path: '/tickets/new', icon: PlusCircle, label: t('tickets.createTicket', 'Create Ticket') },
    { path: '/tickets/analytics', icon: BarChart3, label: t('tickets.analytics', 'Analytics') },
    { path: '/tickets/settings', icon: Settings, label: t('tickets.settings', 'Settings') },
  ];

  // Email Marketing links
  const emailLinks = [
    { path: '/email/contacts', icon: Users, label: t('email.contacts', 'Contacts') },
    { path: '/email/lists', icon: ListFilter, label: t('email.lists', 'Lists') },
    { path: '/email/templates', icon: FileText, label: t('email.templates', 'Templates') },
    { path: '/email/campaigns', icon: Send, label: t('email.campaigns', 'Campaigns') },
    { path: '/email/automations', icon: Zap, label: t('email.automations', 'Automations') },
    { path: '/email/analytics', icon: BarChart3, label: t('email.analytics', 'Analytics') },
  ];

  // Surveys links
  const surveyLinks = [
    { path: '/surveys', icon: FileQuestion, label: t('surveys.allSurveys', 'All Surveys') },
    { path: '/surveys/templates', icon: LayoutTemplate, label: t('surveys.templates', 'Templates') },
    { path: '/surveys/responses', icon: MessageSquare, label: t('surveys.responses', 'Responses') },
    { path: '/surveys/analytics', icon: BarChart3, label: t('surveys.analytics', 'Analytics') },
  ];

  // Get botId from URL if on a bot-specific page
  const botIdMatch = location.pathname.match(/\/bots\/(\d+)/);
  const currentBotId = botIdMatch ? botIdMatch[1] : null;

  // Admin links - only shown to admins and owners
  const adminLinks = [
    { path: '/admin/dashboard', icon: LayoutDashboard, label: t('sidebar.adminDashboard') },
    { path: '/admin/audit-logs', icon: FileText, label: t('sidebar.auditLogs') },
    { path: '/admin/health', icon: Wrench, label: t('sidebar.systemHealth') },
    { path: '/admin/whitelabel', icon: Palette, label: t('sidebar.whiteLabelSettings') },
    { path: '/admin/rate-limiting', icon: ShieldCheck, label: t('sidebar.rateLimiting', 'Rate Limiting') },
    { path: '/admin/roles', icon: UserCog, label: t('sidebar.roles', 'Role Management') },
    { path: '/admin/banners', icon: Megaphone, label: t('sidebar.banners', 'Banners') },
    { path: '/admin/sms', icon: SmsIcon, label: t('sidebar.sms', 'SMS Settings') },
  ];

  // Superadmin links - only shown to superadmins
  const superadminLinks = [
    { path: '/superadmin/dashboard', icon: Crown, label: t('sidebar.superadminDashboard', 'Superadmin Panel') },
  ];

  // Admin menu visibility - organization role OR superadmin OR on admin page
  const isOnAdminPage = location.pathname.startsWith('/admin');
  const isAdmin = userRole === 'admin' || userRole === 'owner' || isSuperAdmin || isOnAdminPage;

  // Simple and reliable isActive check
  const isActive = (path) => {
    const pathname = location.pathname;
    // Exact match or child route match
    if (pathname === path) return true;
    if (pathname.startsWith(path + '/')) return true;
    // Special: /admin matches /admin/dashboard
    if (path === '/admin/dashboard' && pathname === '/admin') return true;
    return false;
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-purple-600 text-white p-3 rounded-lg shadow-lg hover:bg-purple-700"
        aria-label="Toggle menu"
        aria-expanded={isMobileMenuOpen}
      >
        {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
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
                <Bot className="w-10 h-10 text-purple-600" />
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
        <nav className="flex-1 overflow-y-auto p-4" role="navigation" aria-label="Main navigation">
          <ul className="space-y-2">
            {navLinks.map((link) => (
              <li key={link.path}>
                <Link
                  to={link.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  aria-label={link.label}
                  aria-current={isActive(link.path) ? 'page' : undefined}
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
                  <link.icon className="w-5 h-5" aria-hidden="true" />
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
                  aria-label={link.label}
                  aria-current={isActive(link.path) ? 'page' : undefined}
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
                  <link.icon className="w-5 h-5" aria-hidden="true" />
                  <span className="font-medium">{link.label}</span>
                </Link>
              </li>
            ))}

            {/* Revenue Recovery Section */}
            <li className="pt-4 pb-2">
              <div className="flex items-center gap-2 px-4">
                <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700"></div>
                <span className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider">
                  {t('recovery.sidebarTitle')}
                </span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700"></div>
              </div>
            </li>
            {recoveryLinks.map((link) => (
              <li key={link.path}>
                <Link
                  to={link.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  aria-label={link.label}
                  aria-current={isActive(link.path) ? 'page' : undefined}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg
                    transition-all duration-200
                    ${
                      isActive(link.path)
                        ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-green-50 dark:hover:bg-slate-800 hover:text-green-600 dark:hover:text-green-400'
                    }
                  `}
                >
                  <link.icon className="w-5 h-5" aria-hidden="true" />
                  <span className="font-medium">{link.label}</span>
                </Link>
              </li>
            ))}

            {/* Helpdesk Section */}
            <li className="pt-4 pb-2">
              <div className="flex items-center gap-2 px-4">
                <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700"></div>
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                  {t('sidebar.helpdesk', 'Helpdesk')}
                </span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700"></div>
              </div>
            </li>
            {helpdeskLinks.map((link) => (
              <li key={link.path}>
                <Link
                  to={link.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  aria-label={link.label}
                  aria-current={isActive(link.path) ? 'page' : undefined}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg
                    transition-all duration-200
                    ${
                      isActive(link.path)
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400'
                    }
                  `}
                >
                  <link.icon className="w-5 h-5" aria-hidden="true" />
                  <span className="font-medium">{link.label}</span>
                </Link>
              </li>
            ))}

            {/* Email Marketing Section */}
            <li className="pt-4 pb-2">
              <div className="flex items-center gap-2 px-4">
                <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700"></div>
                <span className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                  {t('sidebar.emailMarketing', 'Email Marketing')}
                </span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700"></div>
              </div>
            </li>
            {emailLinks.map((link) => (
              <li key={link.path}>
                <Link
                  to={link.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  aria-label={link.label}
                  aria-current={isActive(link.path) ? 'page' : undefined}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg
                    transition-all duration-200
                    ${
                      isActive(link.path)
                        ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-slate-800 hover:text-orange-600 dark:hover:text-orange-400'
                    }
                  `}
                >
                  <link.icon className="w-5 h-5" aria-hidden="true" />
                  <span className="font-medium">{link.label}</span>
                </Link>
              </li>
            ))}

            {/* Surveys Section */}
            <li className="pt-4 pb-2">
              <div className="flex items-center gap-2 px-4">
                <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700"></div>
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                  {t('sidebar.surveys', 'Surveys')}
                </span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700"></div>
              </div>
            </li>
            {surveyLinks.map((link) => (
              <li key={link.path}>
                <Link
                  to={link.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  aria-label={link.label}
                  aria-current={isActive(link.path) ? 'page' : undefined}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg
                    transition-all duration-200
                    ${
                      isActive(link.path)
                        ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400'
                    }
                  `}
                >
                  <link.icon className="w-5 h-5" aria-hidden="true" />
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
                    <Shuffle className="w-5 h-5" />
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
                    <Wrench className="w-5 h-5" />
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
                    <Target className="w-5 h-5" />
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
                      aria-label={link.label}
                      aria-current={isActive(link.path) ? 'page' : undefined}
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
                      <link.icon className="w-5 h-5" aria-hidden="true" />
                      <span className="font-medium">{link.label}</span>
                    </Link>
                  </li>
                ))}
              </>
            )}

            {/* Superadmin Section - Only visible to superadmins */}
            {isSuperAdmin && (
              <>
                <li className="pt-4 pb-2">
                  <div className="flex items-center gap-2 px-4">
                    <div className="flex-1 h-px bg-yellow-400 dark:bg-yellow-600"></div>
                    <span className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 uppercase tracking-wider">
                      {t('sidebar.superadmin', 'Superadmin')}
                    </span>
                    <div className="flex-1 h-px bg-yellow-400 dark:bg-yellow-600"></div>
                  </div>
                </li>
                {superadminLinks.map((link) => (
                  <li key={link.path}>
                    <Link
                      to={link.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      aria-label={link.label}
                      aria-current={isActive(link.path) ? 'page' : undefined}
                      className={`
                        flex items-center gap-3 px-4 py-3 rounded-lg
                        transition-all duration-200
                        ${
                          isActive(link.path)
                            ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-md'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-yellow-50 dark:hover:bg-slate-800 hover:text-yellow-600 dark:hover:text-yellow-400'
                        }
                      `}
                    >
                      <link.icon className="w-5 h-5" aria-hidden="true" />
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
                      {isAdmin && !isSuperAdmin && (
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
            <MessageSquare className="w-4 h-4" />
            <span>{t('sidebar.sendFeedback')}</span>
          </button>

          {/* Theme Toggle */}
          <div className="flex items-center justify-between px-3 py-2.5 mb-3 bg-gray-100 dark:bg-slate-800 rounded-lg">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              <span>{isDark ? 'Dark Mode' : 'Light Mode'}</span>
            </div>
            <ThemeToggle />
          </div>

          <button
            onClick={handleLogout}
            className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 font-medium flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
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
