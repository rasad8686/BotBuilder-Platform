import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Settings,
  MessageSquare
} from 'lucide-react';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { useCannedResponsesQuery } from '../../hooks/tickets/useCannedResponses';

export default function CannedResponsesDropdown({ onSelect, onClose }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredId, setHoveredId] = useState(null);
  const dropdownRef = useRef(null);

  const { data, isLoading } = useCannedResponsesQuery();
  const responses = data?.responses || [];

  // Filter responses
  const filteredResponses = responses.filter(response =>
    response.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    response.shortcut?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    response.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by category
  const groupedResponses = filteredResponses.reduce((acc, response) => {
    const category = response.category || t('tickets.uncategorized', 'Uncategorized');
    if (!acc[category]) acc[category] = [];
    acc[category].push(response);
    return acc;
  }, {});

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const hoveredResponse = responses.find(r => r.id === hoveredId);

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-1 w-96 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 overflow-hidden z-20"
    >
      {/* Search */}
      <div className="p-2 border-b border-gray-200 dark:border-slate-700">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('tickets.searchResponses', 'Search responses...')}
          leftIcon={Search}
          size="sm"
          autoFocus
        />
      </div>

      <div className="flex">
        {/* Response List */}
        <div className="flex-1 max-h-64 overflow-y-auto border-r border-gray-200 dark:border-slate-700">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              {t('common.loading', 'Loading...')}
            </div>
          ) : Object.keys(groupedResponses).length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t('tickets.noResponsesFound', 'No responses found')}</p>
            </div>
          ) : (
            Object.entries(groupedResponses).map(([category, items]) => (
              <div key={category}>
                <div className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-900/50 uppercase">
                  {category}
                </div>
                {items.map(response => (
                  <button
                    key={response.id}
                    onClick={() => onSelect(response)}
                    onMouseEnter={() => setHoveredId(response.id)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {response.name}
                      </p>
                    </div>
                    {response.shortcut && (
                      <Badge variant="secondary" size="sm" className="ml-2 shrink-0">
                        {response.shortcut}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Preview Panel */}
        <div className="w-48 max-h-64 overflow-y-auto p-3 bg-gray-50 dark:bg-slate-900/50">
          {hoveredResponse ? (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                {t('tickets.preview', 'Preview')}
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {hoveredResponse.content}
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
              {t('tickets.hoverToPreview', 'Hover to preview')}
            </p>
          )}
        </div>
      </div>

      {/* Manage Link */}
      <div className="border-t border-gray-200 dark:border-slate-700">
        <button
          onClick={() => {
            onClose();
            navigate('/tickets/settings?tab=canned-responses');
          }}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
        >
          <Settings className="w-4 h-4" />
          {t('tickets.manageResponses', 'Manage responses')}
        </button>
      </div>
    </div>
  );
}
