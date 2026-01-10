import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Edit2,
  Trash2,
  Paperclip,
  Download,
  Lock
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

export default function CommentBubble({ comment, isFirst }) {
  const { t } = useTranslation();
  const [showActions, setShowActions] = useState(false);

  const isCustomer = comment.author?.type === 'customer';
  const isInternal = comment.is_internal;
  const isSystem = comment.author?.type === 'system';

  const formatTime = (date) => {
    return new Date(date).toLocaleString('en', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // System message style
  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 italic">
          {comment.content}
          <span className="ml-2 text-xs">
            {formatTime(comment.created_at)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex ${isCustomer ? 'justify-start' : 'justify-end'}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className={`max-w-[80%] ${isCustomer ? 'order-2' : 'order-1'}`}>
        {/* Author Info */}
        <div className={`flex items-center gap-2 mb-1 ${isCustomer ? 'justify-start' : 'justify-end'}`}>
          {/* Avatar */}
          <div className={`
            w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
            ${isCustomer
              ? 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300'
              : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
            }
          `}>
            {comment.author?.name?.charAt(0).toUpperCase() || 'U'}
          </div>

          <div className={`flex items-center gap-2 ${isCustomer ? '' : 'flex-row-reverse'}`}>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {comment.author?.name || t('tickets.unknown', 'Unknown')}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatTime(comment.created_at)}
            </span>
            {isInternal && (
              <Badge variant="warning" size="sm" className="flex items-center gap-1">
                <Lock className="w-3 h-3" />
                {t('tickets.internal', 'Internal')}
              </Badge>
            )}
          </div>
        </div>

        {/* Message Bubble */}
        <div className={`
          relative rounded-2xl px-4 py-3
          ${isInternal
            ? 'bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800'
            : isCustomer
              ? 'bg-gray-100 dark:bg-slate-700 rounded-tl-md'
              : 'bg-purple-600 text-white rounded-tr-md'
          }
        `}>
          {/* Content */}
          <div
            className={`prose prose-sm max-w-none ${!isCustomer && !isInternal ? 'prose-invert' : ''}`}
            dangerouslySetInnerHTML={{ __html: comment.content }}
          />

          {/* Attachments */}
          {comment.attachments?.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-600 space-y-2">
              {comment.attachments.map((attachment, index) => (
                <a
                  key={index}
                  href={attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`
                    flex items-center gap-2 text-sm hover:underline
                    ${isCustomer || isInternal ? 'text-purple-600 dark:text-purple-400' : 'text-purple-200'}
                  `}
                >
                  <Paperclip className="w-4 h-4" />
                  {attachment.name}
                  <Download className="w-3 h-3" />
                </a>
              ))}
            </div>
          )}

          {/* Actions (for own comments) */}
          {showActions && comment.can_edit && (
            <div className={`
              absolute top-2 flex items-center gap-1
              ${isCustomer ? 'right-2' : 'left-2'}
            `}>
              <Button
                variant="ghost"
                size="sm"
                className={`p-1 h-auto ${!isCustomer && !isInternal ? 'text-purple-200 hover:text-white' : ''}`}
              >
                <Edit2 className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`p-1 h-auto ${!isCustomer && !isInternal ? 'text-purple-200 hover:text-red-300' : 'text-red-500'}`}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
