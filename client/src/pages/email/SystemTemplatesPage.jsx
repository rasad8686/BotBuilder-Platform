import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  Eye,
  Copy,
  X,
  Mail,
  Gift,
  Megaphone,
  Bell,
  FileText,
  Newspaper,
  Star,
  Sparkles,
  Check
} from 'lucide-react';
import { useSystemTemplatesQuery, useDuplicateTemplateMutation } from '../../hooks/email/useTemplates';

const CATEGORIES = [
  { id: 'all', name: 'All Templates', icon: Mail },
  { id: 'welcome', name: 'Welcome', icon: Gift },
  { id: 'newsletter', name: 'Newsletter', icon: Newspaper },
  { id: 'promotional', name: 'Promotional', icon: Megaphone },
  { id: 'announcement', name: 'Announcement', icon: Bell },
  { id: 'transactional', name: 'Transactional', icon: FileText }
];

const SystemTemplatesPage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const { data: templates = [], isLoading } = useSystemTemplatesQuery();
  const duplicateMutation = useDuplicateTemplateMutation();

  const filteredTemplates = useMemo(() => {
    let result = [...templates];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query)
      );
    }

    if (selectedCategory !== 'all') {
      result = result.filter(t => t.category === selectedCategory);
    }

    return result;
  }, [templates, searchQuery, selectedCategory]);

  const handleUseTemplate = async (templateId) => {
    try {
      const result = await duplicateMutation.mutateAsync(templateId);
      setCopiedId(templateId);
      setTimeout(() => {
        navigate(`/email/templates/${result.id}`);
      }, 500);
    } catch (error) {
      console.error('Failed to duplicate template:', error);
    }
  };

  const getCategoryIcon = (category) => {
    const cat = CATEGORIES.find(c => c.id === category);
    return cat ? cat.icon : Mail;
  };

  const renderPreviewContent = (template) => {
    if (!template?.blocks) return '';

    return template.blocks.map((block, index) => {
      switch (block.type) {
        case 'header':
          return (
            <div key={index} className="text-center p-4 bg-white">
              <div className="w-32 h-8 bg-gray-200 rounded mx-auto" />
            </div>
          );
        case 'text':
          return (
            <div
              key={index}
              className="px-4 py-2"
              style={{
                textAlign: block.settings?.textAlign || 'left',
                fontSize: block.settings?.fontSize || '16px'
              }}
              dangerouslySetInnerHTML={{ __html: block.content }}
            />
          );
        case 'image':
          return (
            <div key={index} className="p-4 text-center">
              <div
                className="bg-gray-200 rounded mx-auto"
                style={{
                  width: block.settings?.width || '100%',
                  height: '150px'
                }}
              />
            </div>
          );
        case 'button':
          return (
            <div key={index} className="p-4 text-center">
              <span
                className="inline-block px-6 py-3 rounded-lg text-white font-medium"
                style={{
                  backgroundColor: block.settings?.backgroundColor || '#7C3AED'
                }}
              >
                {block.settings?.text || 'Button'}
              </span>
            </div>
          );
        case 'divider':
          return (
            <div key={index} className="px-4 py-2">
              <hr
                style={{
                  borderColor: block.settings?.color || '#E5E7EB',
                  borderStyle: block.settings?.style || 'solid'
                }}
              />
            </div>
          );
        case 'spacer':
          return <div key={index} style={{ height: block.settings?.height || '40px' }} />;
        case 'social':
          return (
            <div key={index} className="p-4 flex justify-center gap-2">
              {(block.settings?.platforms || []).filter(p => p.enabled).map((p, i) => (
                <div key={i} className="w-8 h-8 bg-gray-300 rounded-full" />
              ))}
            </div>
          );
        case 'footer':
          return (
            <div
              key={index}
              className="p-4 text-center text-xs"
              style={{
                backgroundColor: block.settings?.backgroundColor || '#F9FAFB',
                color: block.settings?.textColor || '#6B7280'
              }}
            >
              <p>{block.settings?.companyName || 'Company Name'}</p>
              <p className="mt-1">{block.settings?.address || 'Company Address'}</p>
              {block.settings?.showUnsubscribe && (
                <p className="mt-2 underline">Unsubscribe</p>
              )}
            </div>
          );
        default:
          return null;
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/email/templates')}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-purple-500" />
                System Templates
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Professional pre-built templates ready to use
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0">
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === cat.id
                      ? 'bg-purple-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Templates Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <Mail className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No templates found
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Try adjusting your search or filters
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map(template => {
              const CategoryIcon = getCategoryIcon(template.category);
              return (
                <div
                  key={template.id}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-shadow group"
                >
                  {/* Preview Thumbnail */}
                  <div className="h-56 bg-gray-50 dark:bg-gray-700 relative overflow-hidden">
                    <div className="absolute inset-0 overflow-y-auto scale-75 origin-top pointer-events-none">
                      <div className="bg-white min-h-full">
                        {renderPreviewContent(template)}
                      </div>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setPreviewTemplate(template)}
                        className="px-3 py-2 bg-white text-gray-700 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-50"
                      >
                        <Eye className="w-4 h-4" />
                        Preview
                      </button>
                      <button
                        onClick={() => handleUseTemplate(template.id)}
                        disabled={duplicateMutation.isLoading}
                        className="px-3 py-2 bg-purple-600 text-white rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 hover:bg-purple-700 disabled:opacity-50"
                      >
                        {copiedId === template.id ? (
                          <>
                            <Check className="w-4 h-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Use This
                          </>
                        )}
                      </button>
                    </div>
                    {template.featured && (
                      <span className="absolute top-2 right-2 px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        Featured
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                        {template.name}
                      </h3>
                      <div className="flex items-center gap-1">
                        <CategoryIcon className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                      {template.description}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded capitalize">
                        {template.category}
                      </span>
                      {template.responsive && (
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded">
                          Responsive
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  {previewTemplate.name}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {previewTemplate.description}
                </p>
              </div>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-auto p-4 bg-gray-100 dark:bg-gray-900">
              <div className="max-w-[600px] mx-auto bg-white shadow-lg">
                {renderPreviewContent(previewTemplate)}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setPreviewTemplate(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Close
              </button>
              <button
                onClick={() => {
                  handleUseTemplate(previewTemplate.id);
                  setPreviewTemplate(null);
                }}
                disabled={duplicateMutation.isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Use This Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemTemplatesPage;
