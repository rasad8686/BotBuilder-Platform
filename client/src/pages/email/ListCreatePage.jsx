import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, ListFilter, AlertCircle, Users } from 'lucide-react';
import { useListQuery, useCreateListMutation, useUpdateListMutation } from '../../hooks/email/useLists';
import { useContactsQuery } from '../../hooks/email/useContacts';
import ListRuleBuilder from '../../components/email/ListRuleBuilder';

const ListCreatePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'static', // static | dynamic
    rules: []
  });
  const [errors, setErrors] = useState({});
  const [previewCount, setPreviewCount] = useState(null);

  // Fetch existing list if editing
  const { data: existingList, isLoading: listLoading } = useListQuery(id, { enabled: isEditing });

  // Preview contacts count for dynamic lists
  const { data: previewData, refetch: refetchPreview } = useContactsQuery(
    { rules: formData.rules, pageSize: 1 },
    { enabled: formData.type === 'dynamic' && formData.rules.length > 0 }
  );

  // Mutations
  const createMutation = useCreateListMutation();
  const updateMutation = useUpdateListMutation();

  // Load existing data
  useEffect(() => {
    if (existingList) {
      setFormData({
        name: existingList.name || '',
        description: existingList.description || '',
        type: existingList.type || 'static',
        rules: existingList.rules || []
      });
    }
  }, [existingList]);

  // Update preview count
  useEffect(() => {
    if (previewData) {
      setPreviewCount(previewData.total);
    }
  }, [previewData]);

  // Handle rules change
  const handleRulesChange = (rules) => {
    setFormData(prev => ({ ...prev, rules }));
    // Debounce preview fetch
    const timer = setTimeout(() => {
      refetchPreview();
    }, 500);
    return () => clearTimeout(timer);
  };

  // Validate form
  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = t('email.listForm.nameRequired', 'Name is required');
    }

    if (formData.type === 'dynamic' && formData.rules.length === 0) {
      newErrors.rules = t('email.listForm.rulesRequired', 'At least one rule is required for dynamic lists');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ id, ...formData });
      } else {
        await createMutation.mutateAsync(formData);
      }
      navigate('/email/lists');
    } catch (err) {
      if (err.response?.data?.errors) {
        setErrors(err.response.data.errors);
      } else {
        setErrors({ submit: err.message });
      }
    }
  };

  const isLoading = createMutation.isLoading || updateMutation.isLoading;

  if (isEditing && listLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate('/email/lists')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('email.listForm.backToLists', 'Back to Lists')}
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
            <ListFilter className="w-8 h-8 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isEditing
                ? t('email.listForm.editTitle', 'Edit List')
                : t('email.listForm.createTitle', 'Create List')
              }
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              {isEditing
                ? t('email.listForm.editSubtitle', 'Update list settings')
                : t('email.listForm.createSubtitle', 'Create a new list to organize contacts')
              }
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
          {errors.submit && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <p className="text-red-600 dark:text-red-400">{errors.submit}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('email.listForm.name', 'Name')} *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder={t('email.listForm.namePlaceholder', 'e.g., Newsletter Subscribers')}
                className={`
                  w-full px-4 py-2 border rounded-lg bg-white dark:bg-slate-900
                  text-gray-900 dark:text-white
                  focus:ring-2 focus:ring-purple-500 focus:border-transparent
                  ${errors.name ? 'border-red-500' : 'border-gray-300 dark:border-slate-600'}
                `}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-500">{errors.name}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('email.listForm.description', 'Description')}
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder={t('email.listForm.descriptionPlaceholder', 'Describe this list...')}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('email.listForm.type', 'Type')}
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label
                  className={`
                    flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors
                    ${formData.type === 'static'
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-200 dark:border-slate-600 hover:border-purple-300'
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="type"
                    value="static"
                    checked={formData.type === 'static'}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value, rules: [] }))}
                    className="mt-1 text-purple-600"
                  />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {t('email.listForm.static', 'Static')}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('email.listForm.staticDesc', 'Manually add and remove contacts')}
                    </p>
                  </div>
                </label>

                <label
                  className={`
                    flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors
                    ${formData.type === 'dynamic'
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-200 dark:border-slate-600 hover:border-purple-300'
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="type"
                    value="dynamic"
                    checked={formData.type === 'dynamic'}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                    className="mt-1 text-purple-600"
                  />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {t('email.listForm.dynamic', 'Dynamic')}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('email.listForm.dynamicDesc', 'Automatically add contacts based on rules')}
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Dynamic Rules */}
            {formData.type === 'dynamic' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('email.listForm.rules', 'Rules')}
                  </label>
                  {previewCount !== null && (
                    <div className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400">
                      <Users className="w-4 h-4" />
                      {t('email.listForm.matchingContacts', '{{count}} matching contacts', { count: previewCount })}
                    </div>
                  )}
                </div>

                <ListRuleBuilder
                  rules={formData.rules}
                  onChange={handleRulesChange}
                />

                {errors.rules && (
                  <p className="mt-2 text-sm text-red-500">{errors.rules}</p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => navigate('/email/lists')}
                className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                {t('email.listForm.cancel', 'Cancel')}
              </button>
              <motion.button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Save className="w-4 h-4" />
                {isLoading
                  ? t('email.listForm.saving', 'Saving...')
                  : isEditing
                    ? t('email.listForm.update', 'Update List')
                    : t('email.listForm.create', 'Create List')
                }
              </motion.button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ListCreatePage;
