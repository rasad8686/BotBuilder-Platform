import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Home, Bot, Plus, Pencil, GitBranch, Brain, Wrench, Users, RefreshCw,
  ClipboardList, Target, Palette, MessageSquare, Smartphone, Phone, Mic,
  CreditCard, Key, Link2, BarChart3, Settings, Lock, Shield, Building2,
  TrendingUp, ShoppingCart, Heart, Briefcase, Activity, Brush, Gauge, Puzzle, Plug
} from 'lucide-react';

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
      { label: t('breadcrumb.dashboard', 'Dashboard'), path: '/dashboard', Icon: Home }
    ];

    // Route label mappings with Lucide icons
    const labelMap = {
      'mybots': { label: t('breadcrumb.myBots', 'My Bots'), Icon: Bot },
      'my-bots': { label: t('breadcrumb.myBots', 'My Bots'), Icon: Bot },
      'bots': { label: t('breadcrumb.bots', 'Bots'), Icon: Bot },
      'create-bot': { label: t('breadcrumb.createBot', 'Create Bot'), Icon: Plus },
      'edit': { label: t('breadcrumb.edit', 'Edit'), Icon: Pencil },
      'flow': { label: t('breadcrumb.flowBuilder', 'Flow Builder'), Icon: GitBranch },
      'ai-config': { label: t('breadcrumb.aiConfig', 'AI Configuration'), Icon: Brain },
      'tools': { label: t('breadcrumb.tools', 'Tools'), Icon: Wrench },
      'agents': { label: t('breadcrumb.agents', 'Agents'), Icon: Users },
      'workflows': { label: t('breadcrumb.workflows', 'Workflows'), Icon: RefreshCw },
      'executions': { label: t('breadcrumb.executions', 'Executions'), Icon: ClipboardList },
      'orchestrations': { label: t('breadcrumb.orchestrations', 'Orchestrations'), Icon: GitBranch },
      'intents': { label: t('breadcrumb.intents', 'Intents'), Icon: Target },
      'widget': { label: t('breadcrumb.widget', 'Widget Settings'), Icon: Palette },
      'messages': { label: t('breadcrumb.messages', 'Messages'), Icon: MessageSquare },
      'knowledge': { label: t('breadcrumb.knowledge', 'Knowledge Base'), Icon: Brain },
      'channels': { label: t('breadcrumb.channels', 'Channels'), Icon: Smartphone },
      'ai-flow': { label: t('breadcrumb.aiFlow', 'AI Flow Studio'), Icon: Bot },
      'agent-studio': { label: t('breadcrumb.agentStudio', 'Agent Studio'), Icon: Target },
      'autonomous-agents': { label: t('breadcrumb.autonomousAgents', 'Autonomous Agents'), Icon: Users },
      'autonomous': { label: t('breadcrumb.autonomousAgents', 'Autonomous Agents'), Icon: Users },
      'tasks': { label: t('breadcrumb.tasks', 'Tasks'), Icon: ClipboardList },
      'work-clone': { label: t('breadcrumb.workClone', 'Work Clone'), Icon: Users },
      'clone-training': { label: t('breadcrumb.training', 'Training'), Icon: Brain },
      'clone-settings': { label: t('breadcrumb.settings', 'Settings'), Icon: Settings },
      'voice-bots': { label: t('breadcrumb.voiceBots', 'Voice Bots'), Icon: Phone },
      'call-history': { label: t('breadcrumb.callHistory', 'Call History'), Icon: ClipboardList },
      'voice-to-bot': { label: t('breadcrumb.voiceToBot', 'Voice to Bot'), Icon: Mic },
      'fine-tuning': { label: t('breadcrumb.fineTuning', 'Fine Tuning'), Icon: Brain },
      'billing': { label: t('breadcrumb.billing', 'Billing'), Icon: CreditCard },
      'api-tokens': { label: t('breadcrumb.apiTokens', 'API Tokens'), Icon: Key },
      'webhooks': { label: t('breadcrumb.webhooks', 'Webhooks'), Icon: Link2 },
      'usage': { label: t('breadcrumb.usage', 'Usage'), Icon: BarChart3 },
      'settings': { label: t('breadcrumb.settings', 'Settings'), Icon: Settings },
      'security': { label: t('breadcrumb.security', 'Security'), Icon: Lock },
      'sso': { label: t('breadcrumb.sso', 'SSO'), Icon: Shield },
      'team': { label: t('breadcrumb.team', 'Team'), Icon: Users },
      'organizations': { label: t('breadcrumb.organization', 'Organization'), Icon: Building2 },
      'recovery': { label: t('breadcrumb.recovery', 'Recovery'), Icon: TrendingUp },
      'campaigns': { label: t('breadcrumb.campaigns', 'Campaigns'), Icon: Target },
      'carts': { label: t('breadcrumb.carts', 'Abandoned Carts'), Icon: ShoppingCart },
      'customers': { label: t('breadcrumb.customers', 'Customers'), Icon: Heart },
      'admin': { label: t('breadcrumb.admin', 'Admin'), Icon: Briefcase },
      'audit-logs': { label: t('breadcrumb.auditLogs', 'Audit Logs'), Icon: ClipboardList },
      'health': { label: t('breadcrumb.health', 'System Health'), Icon: Activity },
      'whitelabel': { label: t('breadcrumb.whitelabel', 'White Label'), Icon: Brush },
      'rate-limiting': { label: t('breadcrumb.rateLimiting', 'Rate Limiting'), Icon: Gauge },
      'roles': { label: t('breadcrumb.roles', 'Roles'), Icon: Briefcase },
      'marketplace': { label: t('breadcrumb.marketplace', 'Marketplace'), Icon: Puzzle },
      'integrations': { label: t('breadcrumb.integrations', 'Integrations'), Icon: Plug },
      'analytics': { label: t('breadcrumb.analytics', 'Analytics'), Icon: BarChart3 },
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
          Icon: mapped.Icon
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
                  {item.Icon && <item.Icon className="w-4 h-4" aria-hidden="true" />}
                  <span>{item.label}</span>
                </span>
              ) : (
                <Link
                  to={item.path}
                  className="flex items-center gap-1.5 px-2 py-1 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                >
                  {item.Icon && <item.Icon className="w-4 h-4" aria-hidden="true" />}
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
