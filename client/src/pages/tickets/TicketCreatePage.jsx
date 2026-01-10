import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Ticket,
  User,
  Mail,
  Tag,
  AlertCircle,
  Paperclip,
  X
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input, Textarea, Select } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import AssigneeSelector from '../../components/tickets/AssigneeSelector';
import CategorySelector from '../../components/tickets/CategorySelector';
import { useCreateTicketMutation } from '../../hooks/tickets/useTickets';
import { useCategoriesQuery } from '../../hooks/tickets/useTicketCategories';

export default function TicketCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    requester_email: '',
    requester_name: '',
    category_id: '',
    priority: 'medium',
    assignee_id: '',
    tags: []
  });
  const [attachments, setAttachments] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState({});

  // Queries & Mutations
  const { data: categoriesData } = useCategoriesQuery();
  const categories = categoriesData?.categories || [];
  const createMutation = useCreateTicketMutation();

  // Validation
  const validateForm = () => {
    const newErrors = {};

    if (!formData.subject.trim()) {
      newErrors.subject = t('tickets.subjectRequired', 'Subject is required');
    }

    if (!formData.description.trim()) {
      newErrors.description = t('tickets.descriptionRequired', 'Description is required');
    }

    if (!formData.requester_email.trim()) {
      newErrors.requester_email = t('tickets.emailRequired', 'Requester email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.requester_email)) {
      newErrors.requester_email = t('tickets.invalidEmail', 'Invalid email address');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handlers
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleAddTag = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!formData.tags.includes(tagInput.trim())) {
        setFormData(prev => ({
          ...prev,
          tags: [...prev.tags, tagInput.trim()]
        }));
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setAttachments(prev => [...prev, ...files]);
  };

  const handleRemoveAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (createAnother = false) => {
    if (!validateForm()) return;

    try {
      const ticketData = {
        ...formData,
        attachments
      };

      const newTicket = await createMutation.mutateAsync(ticketData);

      if (createAnother) {
        setFormData({
          subject: '',
          description: '',
          requester_email: '',
          requester_name: '',
          category_id: '',
          priority: 'medium',
          assignee_id: '',
          tags: []
        });
        setAttachments([]);
      } else {
        navigate(`/tickets/${newTicket.id}`);
      }
    } catch (error) {
      console.error('Failed to create ticket:', error);
    }
  };

  // Options
  const priorityOptions = [
    { value: 'low', label: t('tickets.priorityLow', 'Low') },
    { value: 'medium', label: t('tickets.priorityMedium', 'Medium') },
    { value: 'high', label: t('tickets.priorityHigh', 'High') },
    { value: 'urgent', label: t('tickets.priorityUrgent', 'Urgent') }
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
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
          <Ticket className="w-7 h-7 text-purple-600" />
          {t('tickets.createTicket', 'Create New Ticket')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('tickets.createDescription', 'Fill in the details below to create a new support ticket')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Subject & Description */}
          <Card>
            <CardHeader>
              <CardTitle>{t('tickets.ticketDetails', 'Ticket Details')}</CardTitle>
            </CardHeader>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('tickets.subject', 'Subject')} *
                </label>
                <Input
                  value={formData.subject}
                  onChange={(e) => handleChange('subject', e.target.value)}
                  placeholder={t('tickets.subjectPlaceholder', 'Brief description of the issue')}
                  error={errors.subject}
                />
                {errors.subject && (
                  <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.subject}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('tickets.description', 'Description')} *
                </label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder={t('tickets.descriptionPlaceholder', 'Detailed description of the issue...')}
                  rows={6}
                  error={errors.description}
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.description}
                  </p>
                )}
              </div>

              {/* Attachments */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('tickets.attachments', 'Attachments')}
                </label>
                <div className="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg p-4">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="flex flex-col items-center cursor-pointer"
                  >
                    <Paperclip className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {t('tickets.dropFiles', 'Click to upload or drag and drop')}
                    </span>
                  </label>
                </div>

                {attachments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {attachments.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-800 rounded-lg"
                      >
                        <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                          {file.name}
                        </span>
                        <button
                          onClick={() => handleRemoveAttachment(index)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Requester Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-purple-600" />
                {t('tickets.requesterInfo', 'Requester Information')}
              </CardTitle>
            </CardHeader>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('tickets.requesterEmail', 'Email')} *
                </label>
                <Input
                  type="email"
                  value={formData.requester_email}
                  onChange={(e) => handleChange('requester_email', e.target.value)}
                  placeholder="customer@example.com"
                  leftIcon={Mail}
                  error={errors.requester_email}
                />
                {errors.requester_email && (
                  <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.requester_email}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('tickets.requesterName', 'Name')}
                </label>
                <Input
                  value={formData.requester_name}
                  onChange={(e) => handleChange('requester_name', e.target.value)}
                  placeholder={t('tickets.namePlaceholder', 'Customer name')}
                  leftIcon={User}
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Properties */}
          <Card>
            <CardHeader>
              <CardTitle>{t('tickets.properties', 'Properties')}</CardTitle>
            </CardHeader>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('tickets.category', 'Category')}
                </label>
                <CategorySelector
                  value={formData.category_id}
                  onChange={(value) => handleChange('category_id', value)}
                  categories={categories}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('tickets.priority', 'Priority')}
                </label>
                <Select
                  value={formData.priority}
                  onChange={(e) => handleChange('priority', e.target.value)}
                  options={priorityOptions}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('tickets.assignee', 'Assignee')}
                </label>
                <AssigneeSelector
                  value={formData.assignee_id}
                  onChange={(value) => handleChange('assignee_id', value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('tickets.tags', 'Tags')}
                </label>
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  placeholder={t('tickets.addTag', 'Type and press Enter')}
                  leftIcon={Tag}
                />
                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.tags.map(tag => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30"
                        onClick={() => handleRemoveTag(tag)}
                      >
                        {tag}
                        <X className="w-3 h-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              className="w-full"
              onClick={() => handleSubmit(false)}
              loading={createMutation.isPending}
              disabled={!formData.subject || !formData.description || !formData.requester_email}
            >
              {t('tickets.create', 'Create Ticket')}
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => handleSubmit(true)}
              loading={createMutation.isPending}
              disabled={!formData.subject || !formData.description || !formData.requester_email}
            >
              {t('tickets.createAndAddAnother', 'Create & Add Another')}
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => navigate('/tickets')}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
