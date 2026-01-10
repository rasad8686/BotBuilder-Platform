import { useTranslation } from 'react-i18next';
import {
  MoreVertical,
  Trash2,
  Clock,
  User
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import TicketStatusBadge from './TicketStatusBadge';
import TicketPriorityBadge from './TicketPriorityBadge';

export default function TicketCard({
  ticket,
  selected,
  onSelect,
  onClick,
  onDelete
}) {
  const { t } = useTranslation();

  const getRelativeTime = (date) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return t('time.justNow', 'just now');
    if (diffMins < 60) return t('time.minsAgo', '{{count}} min ago', { count: diffMins });
    if (diffHours < 24) return t('time.hoursAgo', '{{count}}h ago', { count: diffHours });
    if (diffDays < 7) return t('time.daysAgo', '{{count}}d ago', { count: diffDays });
    return then.toLocaleDateString();
  };

  const getSLAIndicator = () => {
    if (!ticket.sla_status) return null;

    const { breached, warning, remaining_hours } = ticket.sla_status;

    if (breached) {
      return (
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title={t('tickets.slaBreach', 'SLA Breached')} />
      );
    }

    if (warning) {
      return (
        <span className="w-2 h-2 rounded-full bg-yellow-500" title={t('tickets.slaWarning', '{{hours}}h remaining', { hours: remaining_hours })} />
      );
    }

    return (
      <span className="w-2 h-2 rounded-full bg-green-500" title={t('tickets.slaOnTrack', 'On Track')} />
    );
  };

  return (
    <Card
      className={`
        cursor-pointer transition-all hover:shadow-md
        ${selected ? 'ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-900/10' : ''}
      `}
      onClick={onClick}
    >
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Checkbox */}
          <div className="pt-1" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={selected}
              onChange={onSelect}
              className="rounded border-gray-300 dark:border-slate-600 text-purple-600 focus:ring-purple-500"
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {/* Header Row */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                    #{ticket.ticket_number}
                  </span>
                  <TicketStatusBadge status={ticket.status} size="sm" />
                  <TicketPriorityBadge priority={ticket.priority} size="sm" />
                  {getSLAIndicator()}
                  {ticket.unread && (
                    <span className="w-2 h-2 rounded-full bg-blue-500" title={t('tickets.unread', 'Unread')} />
                  )}
                </div>

                {/* Subject */}
                <h3 className="font-medium text-gray-900 dark:text-white truncate">
                  {ticket.subject}
                </h3>

                {/* Requester & Time */}
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1 truncate">
                    <User className="w-3.5 h-3.5" />
                    {ticket.requester_name || ticket.requester_email}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {getRelativeTime(ticket.created_at)}
                  </span>
                </div>
              </div>

              {/* Assignee & Actions */}
              <div className="flex items-center gap-3">
                {/* Assignee Avatar */}
                {ticket.assignee ? (
                  <div
                    className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-sm font-medium text-purple-600 dark:text-purple-400"
                    title={ticket.assignee.name}
                  >
                    {ticket.assignee.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                ) : (
                  <div
                    className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center"
                    title={t('tickets.unassigned', 'Unassigned')}
                  >
                    <User className="w-4 h-4 text-gray-400" />
                  </div>
                )}

                {/* Actions */}
                <div className="relative group" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                  <div className="absolute right-0 top-full mt-1 w-32 py-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                    <button
                      onClick={onDelete}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="w-4 h-4" />
                      {t('common.delete', 'Delete')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
