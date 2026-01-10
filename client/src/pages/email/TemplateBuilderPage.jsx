import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Eye,
  Send,
  Undo,
  Redo,
  Monitor,
  Tablet,
  Smartphone,
  ZoomIn,
  ZoomOut,
  Settings,
  Layers
} from 'lucide-react';
import { useTemplateQuery, useCreateTemplateMutation, useUpdateTemplateMutation, useSendTestEmailMutation } from '../../hooks/email/useTemplates';
import { useEmailBuilder } from '../../hooks/email/useEmailBuilder';
import EmailBuilder from '../../components/email/builder/EmailBuilder';
import BuilderSidebar from '../../components/email/builder/BuilderSidebar';
import BlockSettings from '../../components/email/builder/BlockSettings';

const TemplateBuilderPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [templateName, setTemplateName] = useState('Untitled Template');
  const [category, setCategory] = useState('marketing');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [activeTab, setActiveTab] = useState('content'); // content | settings
  const [previewDevice, setPreviewDevice] = useState('desktop'); // desktop | tablet | mobile
  const [zoom, setZoom] = useState(100);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  const { data: template, isLoading } = useTemplateQuery(id);
  const createMutation = useCreateTemplateMutation();
  const updateMutation = useUpdateTemplateMutation();
  const sendTestMutation = useSendTestEmailMutation();

  const {
    blocks,
    setBlocks,
    selectedBlockId,
    selectedBlock,
    addBlock,
    updateBlock,
    deleteBlock,
    moveBlock,
    duplicateBlock,
    selectBlock,
    undo,
    redo,
    canUndo,
    canRedo
  } = useEmailBuilder([]);

  // Load template data
  useEffect(() => {
    if (template && !isNew) {
      setTemplateName(template.name || 'Untitled Template');
      setCategory(template.category || 'marketing');
      setDescription(template.description || '');
      setSubject(template.subject || '');
      setPreviewText(template.previewText || template.preview_text || '');
      if (template.blocks || template.content_json?.blocks) {
        setBlocks(template.blocks || template.content_json?.blocks || []);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template?.id, isNew]);

  // Auto-save
  useEffect(() => {
    if (!isNew && id && id !== 'undefined' && blocks.length > 0) {
      const timer = setTimeout(() => {
        handleSave(true);
      }, 30000); // Auto-save every 30 seconds

      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, isNew, id]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd' && selectedBlockId) {
        e.preventDefault();
        duplicateBlock(selectedBlockId);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlockId) {
        const activeElement = document.activeElement;
        if (activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA' && !activeElement.isContentEditable) {
          e.preventDefault();
          deleteBlock(selectedBlockId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, duplicateBlock, deleteBlock, selectedBlockId]);

  const handleSave = async (isAutoSave = false) => {
    // Don't save if id is undefined and not new
    if (!isNew && (!id || id === 'undefined')) {
      console.error('Cannot save: invalid template ID');
      return;
    }

    setIsSaving(true);
    try {
      const templateData = {
        name: templateName,
        category,
        description,
        subject,
        preview_text: previewText,
        content_json: { blocks }
      };

      if (isNew) {
        const result = await createMutation.mutateAsync(templateData);
        if (!isAutoSave && result?.template?.id) {
          navigate(`/email/templates/${result.template.id}`, { replace: true });
        }
      } else {
        await updateMutation.mutateAsync({ id, ...templateData });
      }
      setLastSaved(new Date());
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail) return;
    try {
      await sendTestMutation.mutateAsync({
        templateId: id,
        email: testEmail,
        blocks,
        subject,
        previewText
      });
      setShowTestModal(false);
      setTestEmail('');
      alert('Test email sent successfully!');
    } catch (error) {
      alert('Failed to send test email');
    }
  };

  const getPreviewWidth = () => {
    switch (previewDevice) {
      case 'mobile': return 375;
      case 'tablet': return 768;
      default: return 600;
    }
  };

  if (isLoading && !isNew) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/email/templates')}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            className="text-lg font-medium bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-purple-500 rounded px-2 py-1 text-gray-900 dark:text-white"
            placeholder="Template name"
          />
          {lastSaved && (
            <span className="text-xs text-gray-400">
              Last saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSave()}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => navigate(`/email/templates/${id}/preview`)}
            disabled={isNew}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 flex items-center gap-2"
          >
            <Eye className="w-4 h-4" />
            Preview
          </button>
          <button
            onClick={() => setShowTestModal(true)}
            disabled={isNew}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Send Test
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Content Blocks */}
        <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('content')}
              className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
                activeTab === 'content'
                  ? 'text-purple-600 border-b-2 border-purple-600'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              <Layers className="w-4 h-4" />
              Content
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
                activeTab === 'settings'
                  ? 'text-purple-600 border-b-2 border-purple-600'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeTab === 'content' ? (
              <BuilderSidebar onAddBlock={addBlock} />
            ) : (
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="marketing">Marketing</option>
                    <option value="newsletter">Newsletter</option>
                    <option value="welcome">Welcome</option>
                    <option value="transactional">Transactional</option>
                    <option value="promotional">Promotional</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                    placeholder="Template description..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Default Subject Line
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Email subject..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Preview Text
                  </label>
                  <input
                    type="text"
                    value={previewText}
                    onChange={(e) => setPreviewText(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Preview text shown in inbox..."
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center - Canvas */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Canvas Toolbar */}
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={undo}
                disabled={!canUndo}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                title="Undo (Ctrl+Z)"
              >
                <Undo className="w-4 h-4" />
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                title="Redo (Ctrl+Shift+Z)"
              >
                <Redo className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
              <button
                onClick={() => setPreviewDevice('desktop')}
                className={`p-2 ${previewDevice === 'desktop' ? 'bg-purple-100 dark:bg-purple-900 text-purple-600' : 'text-gray-500'}`}
                title="Desktop"
              >
                <Monitor className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPreviewDevice('tablet')}
                className={`p-2 ${previewDevice === 'tablet' ? 'bg-purple-100 dark:bg-purple-900 text-purple-600' : 'text-gray-500'}`}
                title="Tablet"
              >
                <Tablet className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPreviewDevice('mobile')}
                className={`p-2 ${previewDevice === 'mobile' ? 'bg-purple-100 dark:bg-purple-900 text-purple-600' : 'text-gray-500'}`}
                title="Mobile"
              >
                <Smartphone className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoom(Math.max(50, zoom - 10))}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-400 w-12 text-center">
                {zoom}%
              </span>
              <button
                onClick={() => setZoom(Math.min(150, zoom + 10))}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Canvas Area */}
          <div className="flex-1 overflow-auto bg-gray-200 dark:bg-gray-900 p-8">
            <div
              className="mx-auto transition-all duration-200"
              style={{
                width: `${getPreviewWidth()}px`,
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top center'
              }}
            >
              <EmailBuilder
                blocks={blocks}
                selectedBlockId={selectedBlockId}
                onSelectBlock={selectBlock}
                onUpdateBlock={updateBlock}
                onDeleteBlock={deleteBlock}
                onMoveBlock={moveBlock}
                onAddBlock={addBlock}
              />
            </div>
          </div>
        </div>

        {/* Right Sidebar - Block Settings */}
        <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
          {selectedBlock ? (
            <BlockSettings
              block={selectedBlock}
              onUpdate={(updates) => updateBlock(selectedBlockId, updates)}
              onDelete={() => deleteBlock(selectedBlockId)}
              onDuplicate={() => duplicateBlock(selectedBlockId)}
            />
          ) : (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">Select a block to edit its properties</p>
            </div>
          )}
        </div>
      </div>

      {/* Test Email Modal */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Send Test Email
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Enter email address..."
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowTestModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSendTest}
                disabled={!testEmail || sendTestMutation.isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {sendTestMutation.isLoading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateBuilderPage;
