import { useTranslation } from 'react-i18next';
import {
  Ticket,
  UserPlus,
  FileText,
  MessageSquare,
  Tag,
  Merge,
  CheckCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';

const ACTIVITY_ICONS = {
  created: Ticket,
  assigned: UserPlus,
  status_changed: FileText,
  comment_added: MessageSquare,
  priority_changed: AlertTriangle,
  merged: Merge,
  resolved: CheckCircle,
  reopened: Clock
};

const ACTIVITY_COLORS = {
  created: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  assigned: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  status_changed: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-400',
  comment_added: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  priority_changed: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  merged: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
  resolved: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  reopened: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
};

export default function TicketActivityTimeline({ activities }) {
  const { t } = useTranslation();

  const formatTime = (date) => {
    const d = new Date(date);
    return d.toLocaleString('en', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActivityMessage = (activity) => {
    switch (activity.type) {
      case 'created':
        return t('tickets.activityCreated', 'Ticket created');
      case 'assigned':
        return t('tickets.activityAssigned', 'Assigned to {{name}}', { name: activity.data?.assignee_name || 'agent' });
      case 'status_changed':
        return t('tickets.activityStatusChanged', 'Status changed: {{from}} → {{to}}', {
          from: activity.data?.from || 'unknown',
          to: activity.data?.to || 'unknown'
        });
      case 'comment_added':
        return t('tickets.activityCommentAdded', 'Comment added by {{name}}', { name: activity.data?.author_name || 'agent' });
      case 'priority_changed':
        return t('tickets.activityPriorityChanged', 'Priority changed: {{from}} → {{to}}', {
          from: activity.data?.from || 'unknown',
          to: activity.data?.to || 'unknown'
        });
      case 'merged':
        return t('tickets.activityMerged', 'Merged with #{{number}}', { number: activity.data?.merged_ticket_number || '?' });
      case 'resolved':
        return t('tickets.activityResolved', 'Ticket resolved');
      case 'reopened':
        return t('tickets.activityReopened', 'Ticket reopened');
      default:
        return activity.description || t('tickets.activityUnknown', 'Activity recorded');
    }
  };

  if (!activities || activities.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
        {t('tickets.noActivity', 'No activity yet')}
      </p>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200 dark:bg-slate-700" />

      {/* Activities */}
      <div className="space-y-4">
        {activities.map((activity, index) => {
          const Icon = ACTIVITY_ICONS[activity.type] || FileText;
          const colorClass = ACTIVITY_COLORS[activity.type] || ACTIVITY_COLORS.status_changed;

          return (
            <div key={activity.id || index} className="relative flex gap-3 pl-2">
              {/* Icon */}
              <div className={`w-6 h-6 rounded-full flex items-center justify-center z-10 ${colorClass}`}>
                <Icon className="w-3 h-3" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 dark:text-white">
                  {getActivityMessage(activity)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {formatTime(activity.created_at)}
                  {activity.user && (
                    <span className="ml-1">
                      {t('tickets.by', 'by')} {activity.user.name}
                    </span>
                  )}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
