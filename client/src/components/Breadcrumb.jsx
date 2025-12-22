import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * Breadcrumb Navigation Component
 * Format: Ana səhifə → Bölmə → Alt səhifə
 */
export default function Breadcrumb({ items = [], className = '' }) {
  const { t } = useTranslation();
  const location = useLocation();

  // Auto-generate breadcrumbs from current path if no items provided
  const generateBreadcrumbs = () => {
    if (items.length > 0) return items;

    const pathnames = location.pathname.split('/').filter(x => x);
    const breadcrumbs = [
      { label: t('breadcrumb.dashboard', 'Dashboard'), path: '/dashboard', icon: '🏠' }
    ];

    // Route label mappings
    const labelMap = {
      'mybots': { label: t('breadcrumb.myBots', 'My Bots'), icon: '🤖' },
      'my-bots': { label: t('breadcrumb.myBots', 'My Bots'), icon: '🤖' },
      'bots': { label: t('breadcrumb.bots', 'Bots'), icon: '🤖' },
      'create-bot': { label: t('breadcrumb.createBot', 'Create Bot'), icon: '➕' },
      'edit': { label: t('breadcrumb.edit', 'Edit'), icon: '✏️' },
      'flow': { label: t('breadcrumb.flowBuilder', 'Flow Builder'), icon: '🔀' },
      'ai-config': { label: t('breadcrumb.aiConfig', 'AI Configuration'), icon: '🧠' },
      'tools': { label: t('breadcrumb.tools', 'Tools'), icon: '🔧' },
      'agents': { label: t('breadcrumb.agents', 'Agents'), icon: '🤖' },
      'workflows': { label: t('breadcrumb.workflows', 'Workflows'), icon: '🔄' },
      'executions': { label: t('breadcrumb.executions', 'Executions'), icon: '📋' },
      'orchestrations': { label: t('breadcrumb.orchestrations', 'Orchestrations'), icon: '🔀' },
      'intents': { label: t('breadcrumb.intents', 'Intents'), icon: '🎯' },
      'widget': { label: t('breadcrumb.widget', 'Widget Settings'), icon: '🎨' },
      'messages': { label: t('breadcrumb.messages', 'Messages'), icon: '💬' },
      'knowledge': { label: t('breadcrumb.knowledge', 'Knowledge Base'), icon: '🧠' },
      'channels': { label: t('breadcrumb.channels', 'Channels'), icon: '📱' },
      'ai-flow': { label: t('breadcrumb.aiFlow', 'AI Flow Studio'), icon: '🤖' },
      'agent-studio': { label: t('breadcrumb.agentStudio', 'Agent Studio'), icon: '🎯' },
      'autonomous-agents': { label: t('breadcrumb.autonomousAgents', 'Autonomous Agents'), icon: '🦾' },
      'autonomous': { label: t('breadcrumb.autonomousAgents', 'Autonomous Agents'), icon: '🦾' },
      'tasks': { label: t('breadcrumb.tasks', 'Tasks'), icon: '📋' },
      'work-clone': { label: t('breadcrumb.workClone', 'Work Clone'), icon: '👤' },
      'clone-training': { label: t('breadcrumb.training', 'Training'), icon: '📚' },
      'clone-settings': { label: t('breadcrumb.settings', 'Settings'), icon: '⚙️' },
      'voice-bots': { label: t('breadcrumb.voiceBots', 'Voice Bots'), icon: '📞' },
      'call-history': { label: t('breadcrumb.callHistory', 'Call History'), icon: '📋' },
      'voice-to-bot': { label: t('breadcrumb.voiceToBot', 'Voice to Bot'), icon: '🎙️' },
      'fine-tuning': { label: t('breadcrumb.fineTuning', 'Fine Tuning'), icon: '🧠' },
      'billing': { label: t('breadcrumb.billing', 'Billing'), icon: '💳' },
      'api-tokens': { label: t('breadcrumb.apiTokens', 'API Tokens'), icon: '🔑' },
      'webhooks': { label: t('breadcrumb.webhooks', 'Webhooks'), icon: '🔗' },
      'usage': { label: t('breadcrumb.usage', 'Usage'), icon: '📊' },
      'settings': { label: t('breadcrumb.settings', 'Settings'), icon: '⚙️' },
      'security': { label: t('breadcrumb.security', 'Security'), icon: '🔐' },
      'sso': { label: t('breadcrumb.sso', 'SSO'), icon: '🛡️' },
      'team': { label: t('breadcrumb.team', 'Team'), icon: '👥' },
      'organizations': { label: t('breadcrumb.organization', 'Organization'), icon: '🏢' },
      'recovery': { label: t('breadcrumb.recovery', 'Recovery'), icon: '📈' },
      'campaigns': { label: t('breadcrumb.campaigns', 'Campaigns'), icon: '🎯' },
      'carts': { label: t('breadcrumb.carts', 'Abandoned Carts'), icon: '🛒' },
      'customers': { label: t('breadcrumb.customers', 'Customers'), icon: '❤️' },
      'admin': { label: t('breadcrumb.admin', 'Admin'), icon: '👔' },
      'audit-logs': { label: t('breadcrumb.auditLogs', 'Audit Logs'), icon: '📋' },
      'health': { label: t('breadcrumb.health', 'System Health'), icon: '🔧' },
      'whitelabel': { label: t('breadcrumb.whitelabel', 'White Label'), icon: '🎨' },
      'rate-limiting': { label: t('breadcrumb.rateLimiting', 'Rate Limiting'), icon: '🛡️' },
      'roles': { label: t('breadcrumb.roles', 'Roles'), icon: '👔' },
      'marketplace': { label: t('breadcrumb.marketplace', 'Marketplace'), icon: '🧩' },
      'integrations': { label: t('breadcrumb.integrations', 'Integrations'), icon: '🔌' },
      'analytics': { label: t('breadcrumb.analytics', 'Analytics'), icon: '📊' },
    };

    let currentPath = '';
    pathnames.forEach((segment) => {
      currentPath += `/${segment}`;

      // Skip numeric IDs but keep them in the path
      if (/^\d+$/.test(segment)) {
        // Update the last breadcrumb path to include the ID
        if (breadcrumbs.length > 1) {
          breadcrumbs[breadcrumbs.length - 1].path = currentPath;
        }
        return;
      }

      const mapped = labelMap[segment];
      if (mapped) {
        breadcrumbs.push({
          label: mapped.label,
          path: currentPath,
          icon: mapped.icon
        });
      }
    });

    return breadcrumbs;
  };

  const breadcrumbItems = generateBreadcrumbs();

  // Don't show if only dashboard
  if (breadcrumbItems.length <= 1) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`mb-4 ${className}`}
    >
      <ol className="flex items-center flex-wrap gap-1 text-sm">
        {breadcrumbItems.map((item, index) => {
          const isLast = index === breadcrumbItems.length - 1;

          return (
            <li key={item.path} className="flex items-center">
              {index > 0 && (
                <span className="mx-2 text-gray-400 dark:text-gray-500" aria-hidden="true">
                  →
                </span>
              )}

              {isLast ? (
                <span
                  className="flex items-center gap-1.5 px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-md font-medium"
                  aria-current="page"
                >
                  <span aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                </span>
              ) : (
                <Link
                  to={item.path}
                  className="flex items-center gap-1.5 px-2 py-1 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                >
                  <span aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
