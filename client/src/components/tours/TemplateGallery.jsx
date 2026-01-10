import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';

/**
 * Template Gallery Component
 * Displays tour templates with preview and selection
 */
export default function TemplateGallery({ onSelect, onCreateTour }) {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState({ system: [], user: [] });
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [tourName, setTourName] = useState('');

  useEffect(() => {
    loadTemplates();
    loadCategories();
  }, [selectedCategory]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const params = selectedCategory !== 'all' ? `?category=${selectedCategory}` : '';
      const res = await api.get(`/tours/templates${params}`);
      if (res.data.success) {
        setTemplates({
          system: res.data.system || [],
          user: res.data.user || []
        });
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await api.get('/tours/templates/categories');
      if (res.data.success) {
        setCategories(res.data.categories || []);
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    setTourName(template.name);
    if (onSelect) onSelect(template);
  };

  const handlePreview = (template, e) => {
    e.stopPropagation();
    setSelectedTemplate(template);
    setPreviewOpen(true);
  };

  const handleCreateTour = async () => {
    if (!selectedTemplate || !tourName.trim()) return;

    setCreating(true);
    try {
      const res = await api.post(`/tours/templates/${selectedTemplate.id}/create-tour`, {
        name: tourName
      });

      if (res.data.success && onCreateTour) {
        onCreateTour(res.data.tour);
      }
      setPreviewOpen(false);
    } catch (err) {
      console.error('Failed to create tour:', err);
    } finally {
      setCreating(false);
    }
  };

  const getCategoryIcon = (category) => {
    const icons = {
      onboarding: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      ),
      feature: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      announcement: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
        </svg>
      ),
      survey: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      )
    };
    return icons[category] || icons.onboarding;
  };

  const TemplateCard = ({ template, isSystem }) => (
    <div
      onClick={() => handleSelectTemplate(template)}
      className={`relative bg-white dark:bg-gray-800 rounded-lg border-2 transition-all cursor-pointer hover:shadow-lg ${
        selectedTemplate?.id === template.id
          ? 'border-blue-500 shadow-lg'
          : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
      }`}
    >
      {/* Thumbnail */}
      <div className="h-32 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-700 dark:to-gray-600 rounded-t-lg flex items-center justify-center">
        {template.thumbnail_url ? (
          <img
            src={template.thumbnail_url}
            alt={template.name}
            className="w-full h-full object-cover rounded-t-lg"
          />
        ) : (
          <div className="text-4xl text-blue-300 dark:text-gray-500">
            {getCategoryIcon(template.category)}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-medium text-gray-900 dark:text-white truncate">
            {template.name}
          </h3>
          {isSystem && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded">
              {t('tours.system', 'System')}
            </span>
          )}
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
          {template.description}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-gray-500">
            <span className="flex items-center">
              {getCategoryIcon(template.category)}
              <span className="ml-1 capitalize">{template.category}</span>
            </span>
            <span>{template.steps?.length || 0} {t('tours.steps', 'steps')}</span>
          </div>

          <button
            onClick={(e) => handlePreview(template, e)}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            {t('tours.preview', 'Preview')}
          </button>
        </div>

        {!isSystem && template.use_count > 0 && (
          <div className="mt-2 text-xs text-gray-400">
            {t('tours.usedTimes', 'Used {{count}} times', { count: template.use_count })}
          </div>
        )}
      </div>

      {/* Selected indicator */}
      {selectedTemplate?.id === template.id && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          {t('tours.templateGallery', 'Template Gallery')}
        </h2>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {t('tours.allTemplates', 'All Templates')}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 ${
                selectedCategory === cat.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {getCategoryIcon(cat.id)}
              <span>{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Templates Grid */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : (
          <>
            {/* System Templates */}
            {templates.system.length > 0 && (
              <div className="mb-8">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                  {t('tours.systemTemplates', 'System Templates')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {templates.system.map((template) => (
                    <TemplateCard key={template.id} template={template} isSystem={true} />
                  ))}
                </div>
              </div>
            )}

            {/* User Templates */}
            {templates.user.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                  {t('tours.myTemplates', 'My Templates')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {templates.user.map((template) => (
                    <TemplateCard key={template.id} template={template} isSystem={false} />
                  ))}
                </div>
              </div>
            )}

            {templates.system.length === 0 && templates.user.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                {t('tours.noTemplates', 'No templates found')}
              </div>
            )}
          </>
        )}
      </div>

      {/* Preview Modal */}
      {previewOpen && selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {selectedTemplate.name}
                </h3>
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {selectedTemplate.description}
              </p>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[50vh]">
              <h4 className="font-medium text-gray-900 dark:text-white mb-4">
                {t('tours.stepsPreview', 'Steps Preview')} ({selectedTemplate.steps?.length || 0})
              </h4>

              <div className="space-y-3">
                {selectedTemplate.steps?.map((step, index) => (
                  <div
                    key={index}
                    className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    <div>
                      <h5 className="font-medium text-gray-900 dark:text-white">
                        {step.title}
                      </h5>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {step.content}
                      </p>
                      <div className="mt-1 flex items-center space-x-2 text-xs text-gray-400">
                        <span className="capitalize">{step.type}</span>
                        <span>-</span>
                        <span>{step.placement}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {(!selectedTemplate.steps || selectedTemplate.steps.length === 0) && (
                  <div className="text-center py-4 text-gray-500">
                    {t('tours.emptyTemplate', 'This is an empty template. Add steps after creating.')}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('tours.tourName', 'Tour Name')}
                </label>
                <input
                  type="text"
                  value={tourName}
                  onChange={(e) => setTourName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder={t('tours.enterTourName', 'Enter tour name')}
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  onClick={handleCreateTour}
                  disabled={creating || !tourName.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
                >
                  {creating ? t('tours.creating', 'Creating...') : t('tours.createTour', 'Create Tour')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
