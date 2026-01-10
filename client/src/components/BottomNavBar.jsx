import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, Bot, Plus, BarChart3, User } from 'lucide-react';

/**
 * Mobile Bottom Navigation Bar
 * 5 icons: Dashboard, Bots, Create (+), Analytics, Profile
 * Visible only on mobile (md: and below)
 */
export default function BottomNavBar() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    {
      path: '/dashboard',
      Icon: Home,
      label: t('bottomNav.dashboard', 'Home'),
      matchPaths: ['/dashboard']
    },
    {
      path: '/mybots',
      Icon: Bot,
      label: t('bottomNav.bots', 'Bots'),
      matchPaths: ['/mybots', '/my-bots', '/bots']
    },
    {
      path: '/create-bot',
      Icon: Plus,
      label: t('bottomNav.create', 'Create'),
      matchPaths: ['/create-bot'],
      isCreate: true
    },
    {
      path: '/analytics',
      Icon: BarChart3,
      label: t('bottomNav.analytics', 'Analytics'),
      matchPaths: ['/analytics', '/usage']
    },
    {
      path: '/settings',
      Icon: User,
      label: t('bottomNav.profile', 'Profile'),
      matchPaths: ['/settings', '/billing', '/team']
    }
  ];

  const isActive = (matchPaths) => {
    return matchPaths.some(path =>
      location.pathname === path || location.pathname.startsWith(path + '/')
    );
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 shadow-lg safe-area-bottom"
      role="navigation"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const active = isActive(item.matchPaths);

          if (item.isCreate) {
            // Special styling for Create button
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center justify-center -mt-6"
                aria-label={item.label}
              >
                <div className="w-14 h-14 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform">
                  <item.Icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs mt-1 font-medium text-gray-600 dark:text-gray-400">
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 py-2 transition-colors ${
                active
                  ? 'text-purple-600 dark:text-purple-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400'
              }`}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              <item.Icon className={`w-6 h-6 mb-1 ${active ? 'transform scale-110' : ''}`} />
              <span className={`text-xs font-medium ${active ? 'font-semibold' : ''}`}>
                {item.label}
              </span>
              {active && (
                <div className="absolute bottom-0 w-12 h-0.5 bg-purple-600 dark:bg-purple-400 rounded-full" />
              )}
            </Link>
          );
        })}
      </div>

      <style>{`
        .safe-area-bottom {
          padding-bottom: env(safe-area-inset-bottom, 0);
        }
      `}</style>
    </nav>
  );
}
