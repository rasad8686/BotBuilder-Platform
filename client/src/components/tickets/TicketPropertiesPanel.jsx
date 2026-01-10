import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Tag,
  Calendar,
  X
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '../ui/Card';
import { Select, Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import AssigneeSelector from './AssigneeSelector';
import CategorySelector from './CategorySelector';
import { useCategoriesQuery } from '../../hooks/tickets/useTicketCategories';

export default function TicketPropertiesPanel({
  ticket,
  onUpdate,
  loading,
  disabled
}) {
  const { t } = useTranslation();
  const [tagInput, setTagInput] = useState('');
  const [localData, setLocalData] = useState({
    status: ticket.status,
    priority: ticket.priority,
    assignee_id: ticket.assignee_id,
    category_id: ticket.category_id,
    tags: ticket.tags || [],
    due_date: ticket.due_date
  });

  const { data: categoriesData } = useCategoriesQuery();
  const categories = categoriesData?.categories || [];

  // Sync with ticket changes
  useEffect(() => {
    setLocalData({
      status: ticket.status,
      priority: ticket.priority,
      assignee_id: ticket.assignee_id,
      category_id: ticket.category_id,
      tags: ticket.tags || [],
      due_date: ticket.due_date
    });
  }, [ticket]);

  const handleChange = async (field, value) => {
    setLocalData(prev => ({ ...prev, [field]: value }));
    await onUpdate({ [field]: value });
  };

  const handleAddTag = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!localData.tags.includes(tagInput.trim())) {
        const newTags = [...localData.tags, tagInput.trim()];
        handleChange('tags', newTags);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag) => {
    const newTags = localData.tags.filter(t => t !== tag);
    handleChange('tags', newTags);
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
    <Card>
      <CardHeader>
        <CardTitle>{t('tickets.properties', 'Properties')}</CardTitle>
      </CardHeader>
      <div className="p-4 space-y-4">
        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('tickets.status', 'Status')}
          </label>
          <Select
            value={localData.status}
            onChange={(e) => handleChange('status', e.target.value)}
            options={statusOptions}
            disabled={disabled}
          />
        </div>

        {/* Priority */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('tickets.priority', 'Priority')}
          </label>
          <Select
            value={localData.priority}
            onChange={(e) => handleChange('priority', e.target.value)}
            options={priorityOptions}
            disabled={disabled}
          />
        </div>

        {/* Assignee */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('tickets.assignee', 'Assignee')}
          </label>
          <AssigneeSelector
            value={localData.assignee_id}
            onChange={(value) => handleChange('assignee_id', value)}
            disabled={disabled}
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('tickets.category', 'Category')}
          </label>
          <CategorySelector
            value={localData.category_id}
            onChange={(value) => handleChange('category_id', value)}
            categories={categories}
            disabled={disabled}
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('tickets.tags', 'Tags')}
          </label>
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleAddTag}
            placeholder={t('tickets.addTag', 'Add tag...')}
            leftIcon={Tag}
            disabled={disabled}
          />
          {localData.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {localData.tags.map(tag => (
                <Badge
                  key={tag}
                  variant="secondary"
                  size="sm"
                  className="cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30"
                  onClick={() => !disabled && handleRemoveTag(tag)}
                >
                  {tag}
                  {!disabled && <X className="w-3 h-3 ml-1" />}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Due Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('tickets.dueDate', 'Due Date')}
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="datetime-local"
              value={localData.due_date || ''}
              onChange={(e) => handleChange('due_date', e.target.value)}
              disabled={disabled}
              className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
