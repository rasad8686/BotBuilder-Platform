import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  MoreVertical,
  Trash2,
  Copy,
  Merge,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Mail,
  Tag,
  Calendar,
  MessageSquare,
  AlertTriangle
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { LoadingState, ErrorState } from '../../components/ui/States';
import { ConfirmModal } from '../../components/ui/Modal';
import TicketStatusBadge from '../../components/tickets/TicketStatusBadge';
import TicketPriorityBadge from '../../components/tickets/TicketPriorityBadge';
import TicketConversation from '../../components/tickets/TicketConversation';
import TicketReplyBox from '../../components/tickets/TicketReplyBox';
import TicketPropertiesPanel from '../../components/tickets/TicketPropertiesPanel';
import TicketSLAStatus from '../../components/tickets/TicketSLAStatus';
import TicketActivityTimeline from '../../components/tickets/TicketActivityTimeline';
import TicketMergeModal from '../../components/tickets/TicketMergeModal';
import {
  useTicketQuery,
  useUpdateTicketMutation,
  useDeleteTicketMutation,
  useChangeStatusMutation
} from '../../hooks/tickets/useTickets';
import {
  useCommentsQuery,
  useAddCommentMutation
} from '../../hooks/tickets/useTicketComments';

export default function TicketDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();

  // State
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showActivityTimeline, setShowActivityTimeline] = useState(false);

  // Queries & Mutations
  const { data: ticket, isLoading: ticketLoading, error: ticketError, refetch } = useTicketQuery(id);
  const { data: commentsData, isLoading: commentsLoading } = useCommentsQuery(id);
  const comments = commentsData?.comments || [];

  const updateMutation = useUpdateTicketMutation();
  const deleteMutation = useDeleteTicketMutation();
  const changeStatusMutation = useChangeStatusMutation();
  const addCommentMutation = useAddCommentMutation();

  const isLoading = ticketLoading || commentsLoading;

  // Handlers
  const handleUpdateProperty = async (updates) => {
    await updateMutation.mutateAsync({ id, data: updates });
  };

  const handleAddComment = async (content, isInternal, attachments) => {
    await addCommentMutation.mutateAsync({
      ticketId: id,
      content,
      is_internal: isInternal,
      attachments
    });
  };

  const handleResolve = async () => {
    await changeStatusMutation.mutateAsync({ id, status: 'resolved' });
  };

  const handleClose = async () => {
    await changeStatusMutation.mutateAsync({ id, status: 'closed' });
  };

  const handleReopen = async () => {
    await changeStatusMutation.mutateAsync({ id, status: 'open' });
  };

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(id);
    navigate('/tickets');
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd/Ctrl + R for reply
      if ((e.metaKey || e.ctrlKey) && e.key === 'r' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('reply-box')?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isLoading) {
    return <LoadingState title={t('tickets.loading', 'Loading ticket...')} fullPage />;
  }

  if (ticketError) {
    return (
      <ErrorState
        title={t('tickets.loadError', 'Failed to load ticket')}
        description={ticketError.message}
        onRetry={refetch}
        fullPage
      />
    );
  }

  if (!ticket) {
    return (
      <ErrorState
        title={t('tickets.notFound', 'Ticket not found')}
        description={t('tickets.notFoundDescription', 'The ticket you are looking for does not exist.')}
        onRetry={() => navigate('/tickets')}
        fullPage
      />
    );
  }

  const isClosed = ticket.status === 'closed';
  const isResolved = ticket.status === 'resolved';

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              icon={ArrowLeft}
              onClick={() => navigate('/tickets')}
            >
              {t('common.back', 'Back')}
            </Button>

            <div className="h-6 w-px bg-gray-200 dark:bg-slate-700" />

            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                  #{ticket.ticket_number}
                </h1>
                <TicketStatusBadge status={ticket.status} />
                <TicketPriorityBadge priority={ticket.priority} />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 max-w-xl truncate">
                {ticket.subject}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Actions */}
            {!isClosed && !isResolved && (
              <Button
                variant="success"
                size="sm"
                icon={CheckCircle}
                onClick={handleResolve}
                loading={changeStatusMutation.isPending}
              >
                {t('tickets.resolve', 'Resolve')}
              </Button>
            )}

            {isResolved && !isClosed && (
              <Button
                variant="secondary"
                size="sm"
                icon={XCircle}
                onClick={handleClose}
                loading={changeStatusMutation.isPending}
              >
                {t('tickets.close', 'Close')}
              </Button>
            )}

            {isClosed && (
              <Button
                variant="outline"
                size="sm"
                icon={Clock}
                onClick={handleReopen}
                loading={changeStatusMutation.isPending}
              >
                {t('tickets.reopen', 'Reopen')}
              </Button>
            )}

            {/* More Actions Menu */}
            <div className="relative group">
              <Button variant="ghost" size="sm">
                <MoreVertical className="w-4 h-4" />
              </Button>
              <div className="absolute right-0 top-full mt-1 w-48 py-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                <button
                  onClick={() => navigator.clipboard.writeText(`#${ticket.ticket_number}`)}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700"
                >
                  <Copy className="w-4 h-4" />
                  {t('tickets.copyNumber', 'Copy Ticket #')}
                </button>
                <button
                  onClick={() => setShowMergeModal(true)}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700"
                >
                  <Merge className="w-4 h-4" />
                  {t('tickets.merge', 'Merge')}
                </button>
                <div className="border-t border-gray-200 dark:border-slate-700 my-1" />
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="w-4 h-4" />
                  {t('common.delete', 'Delete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Conversation */}
        <div className="flex-1 flex flex-col overflow-hidden max-w-[70%]">
          {/* Requester Info */}
          <div className="p-6 pb-0">
            <Card size="sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <User className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {ticket.requester_name || t('tickets.anonymous', 'Anonymous')}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" />
                      {ticket.requester_email}
                    </p>
                  </div>
                </div>
                <div className="text-right text-sm text-gray-500 dark:text-gray-400">
                  <p>{t('tickets.previousTickets', '{{count}} previous tickets', { count: ticket.requester_ticket_count || 0 })}</p>
                  <p>{t('tickets.createdAt', 'Created {{time}}', { time: new Date(ticket.created_at).toLocaleDateString() })}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Conversation Thread */}
          <div className="flex-1 overflow-y-auto p-6">
            <TicketConversation
              comments={comments}
              ticketDescription={ticket.description}
              ticketCreatedAt={ticket.created_at}
              requesterName={ticket.requester_name}
            />
          </div>

          {/* Reply Box */}
          {!isClosed && (
            <div className="p-6 pt-0">
              <TicketReplyBox
                onSubmit={handleAddComment}
                loading={addCommentMutation.isPending}
                disabled={isClosed}
              />
            </div>
          )}
        </div>

        {/* Right Panel - Properties */}
        <div className="w-[30%] border-l border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Properties */}
            <TicketPropertiesPanel
              ticket={ticket}
              onUpdate={handleUpdateProperty}
              loading={updateMutation.isPending}
              disabled={isClosed}
            />

            {/* SLA Status */}
            <TicketSLAStatus
              firstResponseTarget={ticket.sla?.first_response_target}
              firstResponseAt={ticket.first_response_at}
              resolutionTarget={ticket.sla?.resolution_target}
              resolvedAt={ticket.resolved_at}
              createdAt={ticket.created_at}
            />

            {/* Activity Timeline */}
            <Card>
              <CardHeader className="cursor-pointer" onClick={() => setShowActivityTimeline(!showActivityTimeline)}>
                <CardTitle className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-purple-600" />
                    {t('tickets.activityTimeline', 'Activity Timeline')}
                  </span>
                  <span className="text-gray-400">
                    {showActivityTimeline ? '−' : '+'}
                  </span>
                </CardTitle>
              </CardHeader>
              {showActivityTimeline && (
                <div className="px-4 pb-4">
                  <TicketActivityTimeline activities={ticket.activities || []} />
                </div>
              )}
            </Card>

            {/* Related Tickets */}
            {ticket.related_tickets?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <MessageSquare className="w-4 h-4 text-purple-600" />
                    {t('tickets.relatedTickets', 'Related Tickets')}
                  </CardTitle>
                </CardHeader>
                <div className="px-4 pb-4 space-y-2">
                  {ticket.related_tickets.map(related => (
                    <button
                      key={related.id}
                      onClick={() => navigate(`/tickets/${related.id}`)}
                      className="w-full p-2 text-left rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        #{related.ticket_number}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {related.subject}
                      </p>
                    </button>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Merge Modal */}
      <TicketMergeModal
        isOpen={showMergeModal}
        onClose={() => setShowMergeModal(false)}
        primaryTicket={ticket}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title={t('tickets.deleteTitle', 'Delete Ticket')}
        description={t('tickets.deleteDescription', `Are you sure you want to delete ticket #${ticket.ticket_number}? This action cannot be undone.`)}
        confirmText={t('common.delete', 'Delete')}
        cancelText={t('common.cancel', 'Cancel')}
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
