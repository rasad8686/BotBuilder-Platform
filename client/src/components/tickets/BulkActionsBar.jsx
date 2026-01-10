import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  UserPlus,
  FileText,
  AlertTriangle,
  Trash2
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Select } from '../ui/Input';

export default function BulkActionsBar({
  selectedCount,
  onClearSelection,
  onBulkAction,
  loading
}) {
  const { t } = useTranslation();
  const [selectedAction, setSelectedAction] = useState('');
  const [actionValue, setActionValue] = useState('');

  const handleApply = () => {
    if (!selectedAction) return;
    onBulkAction(selectedAction, { value: actionValue });
    setSelectedAction('');
    setActionValue('');
  };

  const statusOptions = [
    { value: 'open', label: t('tickets.statusOpen', 'Open') },
    { value: 'pending', label: t('tickets.statusPending', 'Pending') },
    { value: 'resolved', label: t('tickets.statusResolved', 'Resolved') },
    { value: 'closed', label: t('tickets.statusClosed', 'Closed') }
  ];

  const priorityOptions = [
    { value: 'low', label: t('tickets.priorityLow', 'Low') },
    { value: 'medium', label: t('tickets.priorityMedium', 'Medium') },
    { value: 'high', label: t('tickets.priorityHigh', 'High') },
    { value: 'urgent', label: t('tickets.priorityUrgent', 'Urgent') }
  ];

  return (
    <div className="sticky top-0 z-10 bg-purple-600 text-white rounded-lg p-4 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="font-medium">
            {t('tickets.selectedCount', '{{count}} tickets selected', { count: selectedCount })}
          </span>
          <button
            onClick={onClearSelection}
            className="text-purple-200 hover:text-white flex items-center gap-1"
          >
            <X className="w-4 h-4" />
            {t('tickets.clearSelection', 'Clear')}
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Assign Action */}
          <div className="relative group">
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-purple-500"
              icon={UserPlus}
            >
              {t('tickets.assign', 'Assign')}
            </Button>
            <div className="absolute right-0 top-full mt-1 w-48 py-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
              <button
                onClick={() => onBulkAction('assign', { assignee_id: '' })}
                className="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700"
              >
                {t('tickets.unassign', 'Unassign')}
              </button>
              <button
                onClick={() => onBulkAction('assign', { assignee_id: 'me' })}
                className="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700"
              >
                {t('tickets.assignToMe', 'Assign to me')}
              </button>
            </div>
          </div>

          {/* Status Action */}
          <div className="relative group">
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-purple-500"
              icon={FileText}
            >
              {t('tickets.changeStatus', 'Status')}
            </Button>
            <div className="absolute right-0 top-full mt-1 w-40 py-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
              {statusOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => onBulkAction('change_status', { status: option.value })}
                  className="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Priority Action */}
          <div className="relative group">
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-purple-500"
              icon={AlertTriangle}
            >
              {t('tickets.changePriority', 'Priority')}
            </Button>
            <div className="absolute right-0 top-full mt-1 w-40 py-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
              {priorityOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => onBulkAction('change_priority', { priority: option.value })}
                  className="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Delete Action */}
          <Button
            variant="ghost"
            size="sm"
            className="text-red-200 hover:bg-red-500 hover:text-white"
            icon={Trash2}
            onClick={() => onBulkAction('delete')}
            loading={loading}
          >
            {t('common.delete', 'Delete')}
          </Button>
        </div>
      </div>
    </div>
  );
}
