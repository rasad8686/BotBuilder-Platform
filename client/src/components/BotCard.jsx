import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Bot, Send, MessageCircle, Gamepad2, Briefcase, Mail,
  Calendar, Link2, Pencil, MessageSquare, MoreVertical,
  Workflow, Cpu, Target, Wrench, RefreshCw, Monitor, Trash2
} from 'lucide-react';
import PermissionGuard from './PermissionGuard';
import { ActionDropdown } from './ui';

/**
 * Reusable Bot Card Component
 * @param {Object} bot - Bot object from API
 * @param {function} onDelete - Delete handler
 */
export default function BotCard({ bot, onDelete }) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Platform icons and colors
  const platformConfig = {
    telegram: { icon: Send, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
    whatsapp: { icon: MessageCircle, color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
    discord: { icon: Gamepad2, color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400' },
    slack: { icon: Briefcase, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
    messenger: { icon: Mail, color: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400' }
  };

  const platform = bot.platform?.toLowerCase() || 'telegram';
  const platformInfo = platformConfig[platform] || platformConfig.telegram;
  const PlatformIcon = platformInfo.icon;

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Dropdown menu items
  const dropdownItems = [
    {
      label: t('bots.flowBuilder'),
      icon: Workflow,
      onClick: () => navigate(`/bots/${bot.id}/flow`)
    },
    {
      label: t('bots.aiConfig'),
      icon: Cpu,
      onClick: () => navigate(`/bots/${bot.id}/ai-config`)
    },
    {
      label: t('bots.agents'),
      icon: Target,
      onClick: () => navigate(`/bots/${bot.id}/agents`)
    },
    {
      label: t('bots.tools'),
      icon: Wrench,
      onClick: () => navigate(`/bots/${bot.id}/tools`)
    },
    {
      label: t('bots.workflows'),
      icon: RefreshCw,
      onClick: () => navigate(`/bots/${bot.id}/workflows`)
    },
    {
      label: t('bots.widget'),
      icon: Monitor,
      onClick: () => navigate(`/bots/${bot.id}/widget`)
    },
    { divider: true },
    {
      label: t('common.delete'),
      icon: Trash2,
      onClick: () => onDelete(bot),
      danger: true
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="bg-white dark:bg-slate-800 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-6 border border-gray-100 dark:border-slate-700"
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 truncate">
            {bot.name}
          </h3>

          {/* Platform Badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${platformInfo.color}`}>
              <PlatformIcon className="w-3.5 h-3.5" />
              <span className="capitalize">{platform}</span>
            </span>

            {/* Active Status Badge */}
            {bot.is_active !== undefined && (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                bot.is_active
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
              }`}>
                <span className={`w-2 h-2 rounded-full ${bot.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                {bot.is_active ? t('bots.active') : t('bots.inactive')}
              </span>
            )}
          </div>
        </div>

        {/* Bot Icon */}
        <div className="ml-3 p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
          <Bot className="w-8 h-8 text-purple-600 dark:text-purple-400" />
        </div>
      </div>

      {/* Description */}
      <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2 min-h-[2.5rem]">
        {bot.description || t('bots.noDescription')}
      </p>

      {/* Metadata */}
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-4 space-y-1.5">
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5" />
          <span>{t('bots.created')}</span>
          <span className="text-gray-700 dark:text-gray-300">{formatDate(bot.created_at)}</span>
        </div>
        {bot.webhook_url && (
          <div className="flex items-center gap-2">
            <Link2 className="w-3.5 h-3.5" />
            <span>{t('bots.webhook')}</span>
            <span className="truncate text-gray-700 dark:text-gray-300 max-w-[150px]">{bot.webhook_url}</span>
          </div>
        )}
      </div>

      {/* Action Buttons - Simplified Layout */}
      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-slate-700">
        {/* Primary Action: Edit */}
        <motion.button
          onClick={() => navigate(`/bot/${bot.id}/edit`)}
          className="flex-1 bg-purple-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
          aria-label={`${t('bots.edit')} - ${bot.name}`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Pencil className="w-4 h-4" />
          <span>{t('bots.edit')}</span>
        </motion.button>

        {/* Secondary Action: Messages */}
        <motion.button
          onClick={() => navigate(`/bot/${bot.id}/messages`)}
          className="flex-1 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 py-2.5 px-4 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
          aria-label={`${t('bots.messages')} - ${bot.name}`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <MessageSquare className="w-4 h-4" />
          <span>{t('bots.messages')}</span>
        </motion.button>

        {/* More Actions Dropdown */}
        <PermissionGuard require="member">
          <ActionDropdown
            items={dropdownItems}
            trigger="icon"
            align="right"
          />
        </PermissionGuard>
      </div>
    </motion.div>
  );
}
