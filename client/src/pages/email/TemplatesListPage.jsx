import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Grid,
  List,
  Filter,
  Copy,
  Trash2,
  Edit,
  Eye,
  Mail,
  Star,
  Clock,
  SortAsc,
  MoreVertical,
  Folder,
  Layout,
  Megaphone,
  Gift,
  Bell,
  FileText
} from 'lucide-react';
import { useTemplatesQuery, useDeleteTemplateMutation, useDuplicateTemplateMutation } from '../../hooks/email/useTemplates';

const CATEGORIES = [
  { id: 'all', name: 'All', icon: Folder },
  { id: 'marketing', name: 'Marketing', icon: Megaphone },
  { id: 'newsletter', name: 'Newsletter', icon: Mail },
  { id: 'welcome', name: 'Welcome', icon: Gift },
  { id: 'transactional', name: 'Transactional', icon: FileText },
  { id: 'promotional', name: 'Promotional', icon: Bell }
];

const SORT_OPTIONS = [
  { id: 'recent', name: 'Recent', icon: Clock },
  { id: 'popular', name: 'Popular', icon: Star },
  { id: 'name', name: 'Name', icon: SortAsc }
];

const TemplatesListPage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [filterType, setFilterType] = useState('all'); // all | my | system
  const [sortBy, setSortBy] = useState('recent');
  const [viewMode, setViewMode] = useState('grid'); // grid | list
  const [activeMenu, setActiveMenu] = useState(null);

  const { data: templates = [], isLoading, refetch } = useTemplatesQuery(
    selectedCategory !== 'all' ? selectedCategory : undefined
  );
  const deleteMutation = useDeleteTemplateMutation();
  const duplicateMutation = useDuplicateTemplateMutation();

  const filteredTemplates = useMemo(() => {
    let result = [...templates];

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query)
      );
    }

    // Filter by type
    if (filterType === 'my') {
      result = result.filter(t => !t.isSystem);
    } else if (filterType === 'system') {
      result = result.filter(t => t.isSystem);
    }

    // Sort
    switch (sortBy) {
      case 'recent':
        result.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        break;
      case 'popular':
        result.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
        break;
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return result;
  }, [templates, searchQuery, filterType, sortBy]);

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      await deleteMutation.mutateAsync(id);
      refetch();
    }
    setActiveMenu(null);
  };

  const handleDuplicate = async (id) => {
    await duplicateMutation.mutateAsync(id);
    refetch();
    setActiveMenu(null);
  };

  const handleEdit = (id) => {
    navigate(`/email/templates/${id}`);
  };

  const handlePreview = (id) => {
    navigate(`/email/templates/${id}/preview`);
  };

  const getCategoryIcon = (category) => {
    const cat = CATEGORIES.find(c => c.id === category);
    return cat ? cat.icon : Folder;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Email Templates
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Create and manage your email templates
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/email/templates/system')}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <Layout className="w-4 h-4 inline-block mr-2" />
                System Templates
              </button>
              <button
                onClick={() => navigate('/email/templates/new')}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Template
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filters Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Filter Type */}
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Templates</option>
                <option value="my">My Templates</option>
                <option value="system">System Templates</option>
              </select>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
              >
                {SORT_OPTIONS.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.name}</option>
                ))}
              </select>
            </div>

            {/* View Mode */}
            <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 ${viewMode === 'grid' ? 'bg-purple-100 dark:bg-purple-900 text-purple-600' : 'bg-white dark:bg-gray-700 text-gray-500'}`}
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 ${viewMode === 'list' ? 'bg-purple-100 dark:bg-purple-900 text-purple-600' : 'bg-white dark:bg-gray-700 text-gray-500'}`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-2">
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === cat.id
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Templates Grid/List */}
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
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {searchQuery ? 'Try adjusting your search or filters' : 'Create your first email template'}
            </p>
            <button
              onClick={() => navigate('/email/templates/new')}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4 inline-block mr-2" />
              Create Template
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredTemplates.map(template => {
              const CategoryIcon = getCategoryIcon(template.category);
              return (
                <div
                  key={template.id}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow group"
                >
                  {/* Preview Thumbnail */}
                  <div
                    className="h-48 bg-gray-100 dark:bg-gray-700 relative cursor-pointer overflow-hidden rounded-t-lg"
                    onClick={() => handlePreview(template.id)}
                  >
                    {template.thumbnail ? (
                      <img
                        src={template.thumbnail}
                        alt={template.name}
                        className="w-full h-full object-cover object-top"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Mail className="w-16 h-16 text-gray-300 dark:text-gray-600" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <Eye className="w-8 h-8 text-white" />
                    </div>
                    {template.isSystem && (
                      <span className="absolute top-2 right-2 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                        System
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {template.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <CategoryIcon className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                            {template.category}
                          </span>
                        </div>
                      </div>
                      <div className="relative">
                        <button
                          onClick={() => setActiveMenu(activeMenu === template.id ? null : template.id)}
                          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                        >
                          <MoreVertical className="w-5 h-5" />
                        </button>
                        {activeMenu === template.id && (
                          <div className="absolute right-0 top-8 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                            <button
                              onClick={() => handleEdit(template.id)}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                            >
                              <Edit className="w-4 h-4" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleDuplicate(template.id)}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                            >
                              <Copy className="w-4 h-4" />
                              Duplicate
                            </button>
                            <button
                              onClick={() => handlePreview(template.id)}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                            >
                              <Eye className="w-4 h-4" />
                              Preview
                            </button>
                            {!template.isSystem && (
                              <button
                                onClick={() => handleDelete(template.id)}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {template.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">
                        {template.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                      <span className="text-xs text-gray-400">
                        {new Date(template.updatedAt).toLocaleDateString()}
                      </span>
                      {template.usageCount > 0 && (
                        <span className="text-xs text-gray-400">
                          Used {template.usageCount}x
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Template
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Updated
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Usage
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredTemplates.map(template => {
                  const CategoryIcon = getCategoryIcon(template.category);
                  return (
                    <tr key={template.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded flex-shrink-0 flex items-center justify-center overflow-hidden">
                            {template.thumbnail ? (
                              <img src={template.thumbnail} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Mail className="w-6 h-6 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {template.name}
                            </div>
                            {template.description && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">
                                {template.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <CategoryIcon className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600 dark:text-gray-300 capitalize">
                            {template.category}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          template.isSystem
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        }`}>
                          {template.isSystem ? 'System' : 'Custom'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {new Date(template.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {template.usageCount || 0}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(template.id)}
                            className="p-1 text-gray-400 hover:text-purple-600 rounded"
                            title="Edit"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDuplicate(template.id)}
                            className="p-1 text-gray-400 hover:text-purple-600 rounded"
                            title="Duplicate"
                          >
                            <Copy className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handlePreview(template.id)}
                            className="p-1 text-gray-400 hover:text-purple-600 rounded"
                            title="Preview"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                          {!template.isSystem && (
                            <button
                              onClick={() => handleDelete(template.id)}
                              className="p-1 text-gray-400 hover:text-red-600 rounded"
                              title="Delete"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Click outside to close menu */}
      {activeMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setActiveMenu(null)}
        />
      )}
    </div>
  );
};

export default TemplatesListPage;
