import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  User,
  UserPlus,
  ChevronDown,
  Check,
  Search
} from 'lucide-react';
import { Input } from '../ui/Input';

// Mock agents data - in real app, this would come from an API
const MOCK_AGENTS = [
  { id: '1', name: 'John Doe', email: 'john@example.com', online: true, ticket_count: 5 },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com', online: true, ticket_count: 3 },
  { id: '3', name: 'Bob Johnson', email: 'bob@example.com', online: false, ticket_count: 8 },
  { id: '4', name: 'Alice Brown', email: 'alice@example.com', online: true, ticket_count: 2 }
];

export default function AssigneeSelector({
  value,
  onChange,
  disabled
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);

  // Get current user ID (mock)
  const currentUserId = '1';

  // Filter agents based on search
  const filteredAgents = MOCK_AGENTS.filter(agent =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get selected agent
  const selectedAgent = MOCK_AGENTS.find(a => a.id === value);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (agentId) => {
    onChange(agentId);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between px-3 py-2 rounded-lg border
          ${disabled
            ? 'bg-gray-100 dark:bg-slate-800 cursor-not-allowed'
            : 'bg-white dark:bg-slate-900 cursor-pointer hover:border-purple-500'
          }
          border-gray-300 dark:border-slate-600
          text-gray-900 dark:text-white
          transition-colors
        `}
      >
        <div className="flex items-center gap-2">
          {selectedAgent ? (
            <>
              <div className="relative">
                <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-xs font-medium text-purple-600 dark:text-purple-400">
                  {selectedAgent.name.charAt(0).toUpperCase()}
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-white dark:border-slate-900 ${selectedAgent.online ? 'bg-green-500' : 'bg-gray-400'}`} />
              </div>
              <span className="text-sm">{selectedAgent.name}</span>
            </>
          ) : (
            <>
              <User className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {t('tickets.unassigned', 'Unassigned')}
              </span>
            </>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-20 mt-1 w-full bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-gray-200 dark:border-slate-700">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('tickets.searchAgents', 'Search agents...')}
              leftIcon={Search}
              size="sm"
            />
          </div>

          {/* Options */}
          <div className="max-h-64 overflow-y-auto">
            {/* Unassigned Option */}
            <button
              onClick={() => handleSelect('')}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 text-left"
            >
              <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center">
                <User className="w-4 h-4 text-gray-400" />
              </div>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {t('tickets.unassigned', 'Unassigned')}
              </span>
              {!value && <Check className="w-4 h-4 text-purple-600 ml-auto" />}
            </button>

            {/* Assign to Me Option */}
            {currentUserId && (
              <button
                onClick={() => handleSelect(currentUserId)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 text-left"
              >
                <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <UserPlus className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                  {t('tickets.assignToMe', 'Assign to me')}
                </span>
                {value === currentUserId && <Check className="w-4 h-4 text-purple-600 ml-auto" />}
              </button>
            )}

            <div className="border-t border-gray-200 dark:border-slate-700 my-1" />

            {/* Agent List */}
            {filteredAgents.map(agent => (
              <button
                key={agent.id}
                onClick={() => handleSelect(agent.id)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 text-left"
              >
                <div className="relative">
                  <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-xs font-medium text-purple-600 dark:text-purple-400">
                    {agent.name.charAt(0).toUpperCase()}
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-white dark:border-slate-800 ${agent.online ? 'bg-green-500' : 'bg-gray-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {agent.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {agent.ticket_count} {t('tickets.tickets', 'tickets')}
                  </p>
                </div>
                {value === agent.id && <Check className="w-4 h-4 text-purple-600" />}
              </button>
            ))}

            {filteredAgents.length === 0 && (
              <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                {t('tickets.noAgentsFound', 'No agents found')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
