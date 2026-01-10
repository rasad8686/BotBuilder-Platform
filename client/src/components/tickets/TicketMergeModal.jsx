import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Merge,
  Search,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import TicketStatusBadge from './TicketStatusBadge';
import { useTicketsQuery } from '../../hooks/tickets/useTickets';

export default function TicketMergeModal({
  isOpen,
  onClose,
  primaryTicket
}) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTickets, setSelectedTickets] = useState([]);

  const { data, isLoading } = useTicketsQuery({
    search: searchQuery,
    exclude: primaryTicket?.id
  });
  const tickets = data?.tickets?.filter(t => t.id !== primaryTicket?.id) || [];

  const handleToggleTicket = (ticket) => {
    setSelectedTickets(prev =>
      prev.some(t => t.id === ticket.id)
        ? prev.filter(t => t.id !== ticket.id)
        : [...prev, ticket]
    );
  };

  const handleMerge = async () => {
    // Merge tickets logic here
    console.log('Merging tickets:', selectedTickets.map(t => t.id), 'into', primaryTicket.id);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <div className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
          <Merge className="w-6 h-6 text-purple-600" />
          {t('tickets.mergeTickets', 'Merge Tickets')}
        </h2>

        {/* Warning */}
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                {t('tickets.mergeWarning', 'This action cannot be undone')}
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                {t('tickets.mergeWarningDescription', 'All comments and attachments from selected tickets will be moved to the primary ticket. The merged tickets will be closed.')}
              </p>
            </div>
          </div>
        </div>

        {/* Primary Ticket */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('tickets.primaryTicket', 'Primary Ticket (Keep)')}
          </h3>
          <Card className="border-purple-300 dark:border-purple-700">
            <div className="p-3 flex items-center gap-3">
              <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                #{primaryTicket?.ticket_number}
              </span>
              <span className="text-sm text-gray-900 dark:text-white truncate flex-1">
                {primaryTicket?.subject}
              </span>
              <TicketStatusBadge status={primaryTicket?.status} size="sm" />
            </div>
          </Card>
        </div>

        {/* Search & Select Tickets */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('tickets.selectTicketsToMerge', 'Select Tickets to Merge')}
          </h3>
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('tickets.searchTickets', 'Search by ticket # or subject...')}
            leftIcon={Search}
            className="mb-3"
          />

          <div className="max-h-64 overflow-y-auto space-y-2 border border-gray-200 dark:border-slate-700 rounded-lg p-2">
            {isLoading ? (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                {t('common.loading', 'Loading...')}
              </div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                {t('tickets.noTicketsFound', 'No tickets found')}
              </div>
            ) : (
              tickets.map(ticket => (
                <button
                  key={ticket.id}
                  onClick={() => handleToggleTicket(ticket)}
                  className={`
                    w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors
                    ${selectedTickets.some(t => t.id === ticket.id)
                      ? 'bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-500'
                      : 'bg-gray-50 dark:bg-slate-800 border-2 border-transparent hover:border-gray-300 dark:hover:border-slate-600'
                    }
                  `}
                >
                  <input
                    type="checkbox"
                    checked={selectedTickets.some(t => t.id === ticket.id)}
                    onChange={() => {}}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                    #{ticket.ticket_number}
                  </span>
                  <span className="text-sm text-gray-900 dark:text-white truncate flex-1">
                    {ticket.subject}
                  </span>
                  <TicketStatusBadge status={ticket.status} size="sm" />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Merge Preview */}
        {selectedTickets.length > 0 && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('tickets.mergePreview', 'Merge Preview')}
            </h4>
            <div className="flex items-center gap-3 flex-wrap">
              {selectedTickets.map((ticket, index) => (
                <span key={ticket.id} className="flex items-center gap-2">
                  <Badge variant="secondary">#{ticket.ticket_number}</Badge>
                  {index < selectedTickets.length - 1 && (
                    <span className="text-gray-400">+</span>
                  )}
                </span>
              ))}
              <ArrowRight className="w-4 h-4 text-gray-400" />
              <Badge variant="primary">#{primaryTicket?.ticket_number}</Badge>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleMerge}
            disabled={selectedTickets.length === 0}
            icon={Merge}
          >
            {t('tickets.mergeSelected', 'Merge {{count}} Tickets', { count: selectedTickets.length })}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
