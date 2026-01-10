import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '../../ui/Card';
import { Button } from '../../ui/Button';
import TicketStatusBadge from '../TicketStatusBadge';
import TicketPriorityBadge from '../TicketPriorityBadge';

export default function RecentTicketsWidget({ tickets }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Mock data if not provided
  const ticketsData = tickets || [
    { id: 1, ticket_number: 'TKT-1234', subject: 'Unable to login to dashboard', status: 'open', priority: 'high', created_at: new Date().toISOString() },
    { id: 2, ticket_number: 'TKT-1233', subject: 'Feature request: Dark mode', status: 'pending', priority: 'low', created_at: new Date(Date.now() - 3600000).toISOString() },
    { id: 3, ticket_number: 'TKT-1232', subject: 'Payment failed', status: 'open', priority: 'urgent', created_at: new Date(Date.now() - 7200000).toISOString() },
    { id: 4, ticket_number: 'TKT-1231', subject: 'How to integrate API?', status: 'resolved', priority: 'medium', created_at: new Date(Date.now() - 86400000).toISOString() },
    { id: 5, ticket_number: 'TKT-1230', subject: 'Billing inquiry', status: 'closed', priority: 'low', created_at: new Date(Date.now() - 172800000).toISOString() }
  ];

  const getRelativeTime = (date) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return t('time.justNow', 'just now');
    if (diffMins < 60) return t('time.minsAgo', '{{count}}m ago', { count: diffMins });
    if (diffHours < 24) return t('time.hoursAgo', '{{count}}h ago', { count: diffHours });
    return t('time.daysAgo', '{{count}}d ago', { count: diffDays });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t('tickets.recentTickets', 'Recent Tickets')}</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/tickets')}
          >
            {t('common.viewAll', 'View All')}
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <div className="divide-y divide-gray-200 dark:divide-slate-700">
        {ticketsData.map(ticket => (
          <button
            key={ticket.id}
            onClick={() => navigate(`/tickets/${ticket.id}`)}
            className="w-full p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 text-left transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                  #{ticket.ticket_number}
                </span>
                <TicketPriorityBadge priority={ticket.priority} size="sm" />
              </div>
              <p className="text-sm text-gray-900 dark:text-white truncate">
                {ticket.subject}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {getRelativeTime(ticket.created_at)}
              </span>
              <TicketStatusBadge status={ticket.status} size="sm" />
            </div>
          </button>
        ))}
      </div>
    </Card>
  );
}
