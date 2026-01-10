import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Send,
  Paperclip,
  MessageSquareText,
  Lock,
  Bold,
  Italic,
  Link2,
  List,
  X
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import CannedResponsesDropdown from './CannedResponsesDropdown';

export default function TicketReplyBox({
  onSubmit,
  loading,
  disabled
}) {
  const { t } = useTranslation();
  const [content, setContent] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [showCannedResponses, setShowCannedResponses] = useState(false);
  const fileInputRef = useRef(null);
  const editorRef = useRef(null);

  const handleSubmit = async () => {
    if (!content.trim() && attachments.length === 0) return;

    await onSubmit(content, isInternal, attachments);
    setContent('');
    setAttachments([]);
    setIsInternal(false);
  };

  const handleKeyDown = (e) => {
    // Cmd/Ctrl + Enter to send
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setAttachments(prev => [...prev, ...files]);
  };

  const handleRemoveAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleInsertCannedResponse = (response) => {
    setContent(prev => prev + (prev ? '\n' : '') + response.content);
    setShowCannedResponses(false);
  };

  const formatText = (format) => {
    const textarea = editorRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);

    let newText = '';
    let cursorOffset = 0;

    switch (format) {
      case 'bold':
        newText = `**${selectedText}**`;
        cursorOffset = 2;
        break;
      case 'italic':
        newText = `*${selectedText}*`;
        cursorOffset = 1;
        break;
      case 'link':
        newText = `[${selectedText}](url)`;
        cursorOffset = 1;
        break;
      case 'list':
        newText = `\n- ${selectedText}`;
        cursorOffset = 3;
        break;
      default:
        return;
    }

    const updatedContent = content.substring(0, start) + newText + content.substring(end);
    setContent(updatedContent);

    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + cursorOffset, start + cursorOffset + selectedText.length);
    }, 0);
  };

  return (
    <Card className={isInternal ? 'border-yellow-300 dark:border-yellow-700' : ''}>
      <div className="p-4">
        {/* Formatting Toolbar */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => formatText('bold')}
              className="p-1.5 h-auto"
              title={t('tickets.bold', 'Bold')}
            >
              <Bold className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => formatText('italic')}
              className="p-1.5 h-auto"
              title={t('tickets.italic', 'Italic')}
            >
              <Italic className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => formatText('link')}
              className="p-1.5 h-auto"
              title={t('tickets.link', 'Link')}
            >
              <Link2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => formatText('list')}
              className="p-1.5 h-auto"
              title={t('tickets.list', 'List')}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>

          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCannedResponses(!showCannedResponses)}
              className="flex items-center gap-1"
            >
              <MessageSquareText className="w-4 h-4" />
              {t('tickets.cannedResponses', 'Canned Responses')}
            </Button>
            {showCannedResponses && (
              <CannedResponsesDropdown
                onSelect={handleInsertCannedResponse}
                onClose={() => setShowCannedResponses(false)}
              />
            )}
          </div>
        </div>

        {/* Text Area */}
        <textarea
          ref={editorRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isInternal
            ? t('tickets.internalNotePlaceholder', 'Add an internal note (not visible to customer)...')
            : t('tickets.replyPlaceholder', 'Type your reply...')
          }
          rows={4}
          disabled={disabled}
          className={`
            w-full px-3 py-2 rounded-lg border resize-none
            focus:ring-2 focus:ring-purple-500 focus:border-transparent
            ${isInternal
              ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
              : 'bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600'
            }
            text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        />

        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {attachments.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-slate-700 rounded-lg text-sm"
              >
                <Paperclip className="w-4 h-4 text-gray-400" />
                <span className="truncate max-w-[150px]">{file.name}</span>
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

        {/* Actions */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-3">
            {/* Attachments */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              className="hidden"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
            >
              <Paperclip className="w-4 h-4 mr-1" />
              {t('tickets.attach', 'Attach')}
            </Button>

            {/* Internal Note Toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isInternal}
                onChange={(e) => setIsInternal(e.target.checked)}
                className="rounded border-gray-300 dark:border-slate-600 text-yellow-500 focus:ring-yellow-500"
                disabled={disabled}
              />
              <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                <Lock className="w-4 h-4" />
                {t('tickets.internalNote', 'Internal Note')}
              </span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              {t('tickets.sendHint', 'Cmd+Enter to send')}
            </span>
            <Button
              onClick={handleSubmit}
              loading={loading}
              disabled={disabled || (!content.trim() && attachments.length === 0)}
              icon={Send}
            >
              {t('tickets.send', 'Send')}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
