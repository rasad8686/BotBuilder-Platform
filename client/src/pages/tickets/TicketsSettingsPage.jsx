import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Settings,
  FolderTree,
  Clock,
  MessageSquareText,
  Cog,
  Plus,
  Edit2,
  Trash2,
  GripVertical,
  Save
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input, Textarea, Select } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { ConfirmModal } from '../../components/ui/Modal';
import { LoadingState } from '../../components/ui/States';
import {
  useCategoriesQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation
} from '../../hooks/tickets/useTicketCategories';
import {
  useSLAPoliciesQuery,
  useCreateSLAPolicyMutation,
  useUpdateSLAPolicyMutation,
  useDeleteSLAPolicyMutation
} from '../../hooks/tickets/useTicketSLA';
import {
  useCannedResponsesQuery,
  useCreateCannedResponseMutation,
  useUpdateCannedResponseMutation,
  useDeleteCannedResponseMutation
} from '../../hooks/tickets/useCannedResponses';

const TABS = {
  CATEGORIES: 'categories',
  SLA: 'sla',
  CANNED_RESPONSES: 'canned-responses',
  GENERAL: 'general'
};

export default function TicketsSettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = searchParams.get('tab') || TABS.CATEGORIES;
  const setActiveTab = (tab) => setSearchParams({ tab });

  // State
  const [editingItem, setEditingItem] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ open: false, item: null, type: null });

  const tabs = [
    { id: TABS.CATEGORIES, label: t('tickets.categories', 'Categories'), icon: FolderTree },
    { id: TABS.SLA, label: t('tickets.slaPolicies', 'SLA Policies'), icon: Clock },
    { id: TABS.CANNED_RESPONSES, label: t('tickets.cannedResponses', 'Canned Responses'), icon: MessageSquareText },
    { id: TABS.GENERAL, label: t('tickets.general', 'General'), icon: Cog }
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          icon={ArrowLeft}
          onClick={() => navigate('/tickets')}
          className="mb-4"
        >
          {t('common.back', 'Back')}
        </Button>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <Settings className="w-7 h-7 text-purple-600" />
          {t('tickets.settings', 'Ticket Settings')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('tickets.settingsDescription', 'Manage categories, SLA policies, and canned responses')}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-slate-700 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
              ${activeTab === tab.id
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }
            `}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === TABS.CATEGORIES && (
        <CategoriesTab
          editingItem={editingItem}
          setEditingItem={setEditingItem}
          deleteModal={deleteModal}
          setDeleteModal={setDeleteModal}
        />
      )}

      {activeTab === TABS.SLA && (
        <SLATab
          editingItem={editingItem}
          setEditingItem={setEditingItem}
          deleteModal={deleteModal}
          setDeleteModal={setDeleteModal}
        />
      )}

      {activeTab === TABS.CANNED_RESPONSES && (
        <CannedResponsesTab
          editingItem={editingItem}
          setEditingItem={setEditingItem}
          deleteModal={deleteModal}
          setDeleteModal={setDeleteModal}
        />
      )}

      {activeTab === TABS.GENERAL && <GeneralTab />}
    </div>
  );
}

// Categories Tab
function CategoriesTab({ editingItem, setEditingItem, deleteModal, setDeleteModal }) {
  const { t } = useTranslation();
  const [newCategory, setNewCategory] = useState({ name: '', description: '', color: '#7c3aed' });

  const { data, isLoading } = useCategoriesQuery();
  const categories = data?.categories || [];
  const createMutation = useCreateCategoryMutation();
  const updateMutation = useUpdateCategoryMutation();
  const deleteMutation = useDeleteCategoryMutation();

  const handleCreate = async () => {
    if (!newCategory.name.trim()) return;
    await createMutation.mutateAsync(newCategory);
    setNewCategory({ name: '', description: '', color: '#7c3aed' });
  };

  const handleUpdate = async () => {
    if (!editingItem?.name.trim()) return;
    await updateMutation.mutateAsync({ id: editingItem.id, data: editingItem });
    setEditingItem(null);
  };

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(deleteModal.item.id);
    setDeleteModal({ open: false, item: null, type: null });
  };

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-6">
      {/* Add New Category */}
      <Card>
        <CardHeader>
          <CardTitle>{t('tickets.addCategory', 'Add New Category')}</CardTitle>
        </CardHeader>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              value={newCategory.name}
              onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t('tickets.categoryName', 'Category name')}
            />
            <Input
              value={newCategory.description}
              onChange={(e) => setNewCategory(prev => ({ ...prev, description: e.target.value }))}
              placeholder={t('tickets.categoryDescription', 'Description (optional)')}
            />
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={newCategory.color}
                onChange={(e) => setNewCategory(prev => ({ ...prev, color: e.target.value }))}
                className="w-10 h-10 rounded border border-gray-300 dark:border-slate-600 cursor-pointer"
              />
              <span className="text-sm text-gray-500">{t('tickets.color', 'Color')}</span>
            </div>
            <Button onClick={handleCreate} loading={createMutation.isPending} icon={Plus}>
              {t('common.add', 'Add')}
            </Button>
          </div>
        </div>
      </Card>

      {/* Categories List */}
      <Card>
        <CardHeader>
          <CardTitle>{t('tickets.existingCategories', 'Existing Categories')}</CardTitle>
        </CardHeader>
        <div className="divide-y divide-gray-200 dark:divide-slate-700">
          {categories.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              {t('tickets.noCategories', 'No categories yet')}
            </div>
          ) : (
            categories.map(category => (
              <div
                key={category.id}
                className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-800/50"
              >
                {editingItem?.id === category.id ? (
                  <div className="flex-1 flex items-center gap-4">
                    <Input
                      value={editingItem.name}
                      onChange={(e) => setEditingItem(prev => ({ ...prev, name: e.target.value }))}
                      className="w-48"
                    />
                    <Input
                      value={editingItem.description || ''}
                      onChange={(e) => setEditingItem(prev => ({ ...prev, description: e.target.value }))}
                      className="w-64"
                    />
                    <input
                      type="color"
                      value={editingItem.color || '#7c3aed'}
                      onChange={(e) => setEditingItem(prev => ({ ...prev, color: e.target.value }))}
                      className="w-10 h-10 rounded border border-gray-300 dark:border-slate-600 cursor-pointer"
                    />
                    <Button size="sm" onClick={handleUpdate} loading={updateMutation.isPending}>
                      {t('common.save', 'Save')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingItem(null)}>
                      {t('common.cancel', 'Cancel')}
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-4">
                      <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                      <span
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: category.color || '#7c3aed' }}
                      />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{category.name}</p>
                        {category.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">{category.description}</p>
                        )}
                      </div>
                      <Badge variant="secondary" size="sm">
                        {category.ticket_count || 0} {t('tickets.tickets', 'tickets')}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Edit2}
                        onClick={() => setEditingItem(category)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        className="text-red-500 hover:text-red-600"
                        onClick={() => setDeleteModal({ open: true, item: category, type: 'category' })}
                      />
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </Card>

      <ConfirmModal
        isOpen={deleteModal.open && deleteModal.type === 'category'}
        onClose={() => setDeleteModal({ open: false, item: null, type: null })}
        onConfirm={handleDelete}
        title={t('tickets.deleteCategory', 'Delete Category')}
        description={t('tickets.deleteCategoryDescription', `Are you sure you want to delete "${deleteModal.item?.name}"?`)}
        confirmText={t('common.delete', 'Delete')}
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

// SLA Tab
function SLATab({ editingItem, setEditingItem, deleteModal, setDeleteModal }) {
  const { t } = useTranslation();
  const [newSLA, setNewSLA] = useState({
    name: '',
    first_response_hours: 4,
    resolution_hours: 24,
    priority: 'medium'
  });

  const { data, isLoading } = useSLAPoliciesQuery();
  const policies = data?.policies || [];
  const createMutation = useCreateSLAPolicyMutation();
  const updateMutation = useUpdateSLAPolicyMutation();
  const deleteMutation = useDeleteSLAPolicyMutation();

  const handleCreate = async () => {
    if (!newSLA.name.trim()) return;
    await createMutation.mutateAsync(newSLA);
    setNewSLA({ name: '', first_response_hours: 4, resolution_hours: 24, priority: 'medium' });
  };

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(deleteModal.item.id);
    setDeleteModal({ open: false, item: null, type: null });
  };

  if (isLoading) return <LoadingState />;

  const priorityOptions = [
    { value: 'low', label: t('tickets.priorityLow', 'Low') },
    { value: 'medium', label: t('tickets.priorityMedium', 'Medium') },
    { value: 'high', label: t('tickets.priorityHigh', 'High') },
    { value: 'urgent', label: t('tickets.priorityUrgent', 'Urgent') }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('tickets.addSLAPolicy', 'Add SLA Policy')}</CardTitle>
        </CardHeader>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Input
              value={newSLA.name}
              onChange={(e) => setNewSLA(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t('tickets.policyName', 'Policy name')}
            />
            <Select
              value={newSLA.priority}
              onChange={(e) => setNewSLA(prev => ({ ...prev, priority: e.target.value }))}
              options={priorityOptions}
            />
            <Input
              type="number"
              value={newSLA.first_response_hours}
              onChange={(e) => setNewSLA(prev => ({ ...prev, first_response_hours: parseInt(e.target.value) }))}
              placeholder={t('tickets.firstResponseHours', 'First response (hrs)')}
            />
            <Input
              type="number"
              value={newSLA.resolution_hours}
              onChange={(e) => setNewSLA(prev => ({ ...prev, resolution_hours: parseInt(e.target.value) }))}
              placeholder={t('tickets.resolutionHours', 'Resolution (hrs)')}
            />
            <Button onClick={handleCreate} loading={createMutation.isPending} icon={Plus}>
              {t('common.add', 'Add')}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('tickets.existingSLAPolicies', 'Existing SLA Policies')}</CardTitle>
        </CardHeader>
        <div className="divide-y divide-gray-200 dark:divide-slate-700">
          {policies.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              {t('tickets.noSLAPolicies', 'No SLA policies yet')}
            </div>
          ) : (
            policies.map(policy => (
              <div
                key={policy.id}
                className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-800/50"
              >
                <div className="flex items-center gap-6">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{policy.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('tickets.forPriority', 'For {{priority}} priority', { priority: policy.priority })}
                    </p>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500">{t('tickets.firstResponse', 'First Response')}:</span>
                    <span className="ml-1 font-medium text-gray-900 dark:text-white">{policy.first_response_hours}h</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500">{t('tickets.resolution', 'Resolution')}:</span>
                    <span className="ml-1 font-medium text-gray-900 dark:text-white">{policy.resolution_hours}h</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  className="text-red-500 hover:text-red-600"
                  onClick={() => setDeleteModal({ open: true, item: policy, type: 'sla' })}
                />
              </div>
            ))
          )}
        </div>
      </Card>

      <ConfirmModal
        isOpen={deleteModal.open && deleteModal.type === 'sla'}
        onClose={() => setDeleteModal({ open: false, item: null, type: null })}
        onConfirm={handleDelete}
        title={t('tickets.deleteSLAPolicy', 'Delete SLA Policy')}
        description={t('tickets.deleteSLAPolicyDescription', `Are you sure you want to delete "${deleteModal.item?.name}"?`)}
        confirmText={t('common.delete', 'Delete')}
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

// Canned Responses Tab
function CannedResponsesTab({ editingItem, setEditingItem, deleteModal, setDeleteModal }) {
  const { t } = useTranslation();
  const [newResponse, setNewResponse] = useState({ name: '', shortcut: '', content: '', category: '' });

  const { data, isLoading } = useCannedResponsesQuery();
  const responses = data?.responses || [];
  const createMutation = useCreateCannedResponseMutation();
  const deleteMutation = useDeleteCannedResponseMutation();

  const handleCreate = async () => {
    if (!newResponse.name.trim() || !newResponse.content.trim()) return;
    await createMutation.mutateAsync(newResponse);
    setNewResponse({ name: '', shortcut: '', content: '', category: '' });
  };

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(deleteModal.item.id);
    setDeleteModal({ open: false, item: null, type: null });
  };

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('tickets.addCannedResponse', 'Add Canned Response')}</CardTitle>
        </CardHeader>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              value={newResponse.name}
              onChange={(e) => setNewResponse(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t('tickets.responseName', 'Response name')}
            />
            <Input
              value={newResponse.shortcut}
              onChange={(e) => setNewResponse(prev => ({ ...prev, shortcut: e.target.value }))}
              placeholder={t('tickets.shortcut', 'Shortcut (e.g., /thanks)')}
            />
            <Input
              value={newResponse.category}
              onChange={(e) => setNewResponse(prev => ({ ...prev, category: e.target.value }))}
              placeholder={t('tickets.responseCategory', 'Category (optional)')}
            />
          </div>
          <Textarea
            value={newResponse.content}
            onChange={(e) => setNewResponse(prev => ({ ...prev, content: e.target.value }))}
            placeholder={t('tickets.responseContent', 'Response content...')}
            rows={4}
          />
          <Button onClick={handleCreate} loading={createMutation.isPending} icon={Plus}>
            {t('common.add', 'Add')}
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('tickets.existingCannedResponses', 'Existing Canned Responses')}</CardTitle>
        </CardHeader>
        <div className="divide-y divide-gray-200 dark:divide-slate-700">
          {responses.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              {t('tickets.noCannedResponses', 'No canned responses yet')}
            </div>
          ) : (
            responses.map(response => (
              <div
                key={response.id}
                className="p-4 hover:bg-gray-50 dark:hover:bg-slate-800/50"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 dark:text-white">{response.name}</p>
                      {response.shortcut && (
                        <Badge variant="secondary" size="sm">{response.shortcut}</Badge>
                      )}
                      {response.category && (
                        <Badge variant="outline" size="sm">{response.category}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                      {response.content}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    className="text-red-500 hover:text-red-600"
                    onClick={() => setDeleteModal({ open: true, item: response, type: 'canned' })}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <ConfirmModal
        isOpen={deleteModal.open && deleteModal.type === 'canned'}
        onClose={() => setDeleteModal({ open: false, item: null, type: null })}
        onConfirm={handleDelete}
        title={t('tickets.deleteCannedResponse', 'Delete Canned Response')}
        description={t('tickets.deleteCannedResponseDescription', `Are you sure you want to delete "${deleteModal.item?.name}"?`)}
        confirmText={t('common.delete', 'Delete')}
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

// General Tab
function GeneralTab() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState({
    default_assignee: '',
    auto_close_days: 7,
    allow_reopen: true,
    notify_on_new_ticket: true,
    notify_on_assignment: true
  });

  const handleSave = () => {
    // Save settings
    console.log('Saving settings:', settings);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('tickets.generalSettings', 'General Settings')}</CardTitle>
      </CardHeader>
      <div className="p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('tickets.defaultAssignee', 'Default Assignee')}
          </label>
          <Select
            value={settings.default_assignee}
            onChange={(e) => setSettings(prev => ({ ...prev, default_assignee: e.target.value }))}
            options={[
              { value: '', label: t('tickets.noDefaultAssignee', 'No default assignee') },
              { value: 'round-robin', label: t('tickets.roundRobin', 'Round Robin') }
            ]}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('tickets.autoCloseDays', 'Auto-close resolved tickets after (days)')}
          </label>
          <Input
            type="number"
            value={settings.auto_close_days}
            onChange={(e) => setSettings(prev => ({ ...prev, auto_close_days: parseInt(e.target.value) }))}
            className="w-32"
          />
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.allow_reopen}
              onChange={(e) => setSettings(prev => ({ ...prev, allow_reopen: e.target.checked }))}
              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {t('tickets.allowReopen', 'Allow customers to reopen closed tickets')}
            </span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.notify_on_new_ticket}
              onChange={(e) => setSettings(prev => ({ ...prev, notify_on_new_ticket: e.target.checked }))}
              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {t('tickets.notifyOnNewTicket', 'Send email notification on new ticket')}
            </span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.notify_on_assignment}
              onChange={(e) => setSettings(prev => ({ ...prev, notify_on_assignment: e.target.checked }))}
              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {t('tickets.notifyOnAssignment', 'Send email notification when assigned to a ticket')}
            </span>
          </label>
        </div>

        <Button onClick={handleSave} icon={Save}>
          {t('common.saveSettings', 'Save Settings')}
        </Button>
      </div>
    </Card>
  );
}
