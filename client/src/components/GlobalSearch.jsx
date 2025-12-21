import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Global Search Component
 * Ctrl+K to open, searches bots and pages
 */
export default function GlobalSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ bots: [], pages: [] });
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const modalRef = useRef(null);

  // Available pages for search
  const pages = [
    { name: t('search.dashboard', 'Dashboard'), path: '/dashboard', icon: '🏠', keywords: ['home', 'ana', 'panel'] },
    { name: t('search.myBots', 'My Bots'), path: '/mybots', icon: '🤖', keywords: ['bots', 'botlar'] },
    { name: t('search.createBot', 'Create Bot'), path: '/create-bot', icon: '➕', keywords: ['new', 'yeni', 'yarat'] },
    { name: t('search.aiFlow', 'AI Flow Studio'), path: '/ai-flow', icon: '🤖', keywords: ['flow', 'studio', 'ai'] },
    { name: t('search.agentStudio', 'Agent Studio'), path: '/agent-studio', icon: '🎯', keywords: ['agent', 'studio'] },
    { name: t('search.autonomousAgents', 'Autonomous Agents'), path: '/autonomous-agents', icon: '🦾', keywords: ['autonomous', 'auto'] },
    { name: t('search.workflows', 'Workflows'), path: '/workflows', icon: '🔄', keywords: ['workflow', 'axin'] },
    { name: t('search.knowledge', 'Knowledge Base'), path: '/knowledge', icon: '🧠', keywords: ['knowledge', 'bilik'] },
    { name: t('search.channels', 'Channels'), path: '/channels', icon: '📱', keywords: ['channel', 'kanal'] },
    { name: t('search.integrations', 'Integrations'), path: '/integrations', icon: '🔌', keywords: ['integration', 'inteqrasiya'] },
    { name: t('search.voiceBots', 'Voice Bots'), path: '/voice-bots', icon: '📞', keywords: ['voice', 'ses'] },
    { name: t('search.callHistory', 'Call History'), path: '/call-history', icon: '📋', keywords: ['call', 'zeng'] },
    { name: t('search.workClone', 'Work Clone'), path: '/work-clone', icon: '👤', keywords: ['clone', 'klon'] },
    { name: t('search.voiceToBot', 'Voice to Bot'), path: '/voice-to-bot', icon: '🎙️', keywords: ['voice', 'ses'] },
    { name: t('search.fineTuning', 'Fine Tuning'), path: '/fine-tuning', icon: '🧠', keywords: ['fine', 'tuning'] },
    { name: t('search.marketplace', 'Marketplace'), path: '/marketplace', icon: '🧩', keywords: ['market', 'bazar'] },
    { name: t('search.billing', 'Billing'), path: '/billing', icon: '💳', keywords: ['billing', 'odenis', 'payment'] },
    { name: t('search.apiTokens', 'API Tokens'), path: '/api-tokens', icon: '🔑', keywords: ['api', 'token', 'key'] },
    { name: t('search.webhooks', 'Webhooks'), path: '/webhooks', icon: '🔗', keywords: ['webhook', 'hook'] },
    { name: t('search.usage', 'Usage'), path: '/usage', icon: '📊', keywords: ['usage', 'istifade'] },
    { name: t('search.settings', 'Settings'), path: '/settings', icon: '⚙️', keywords: ['settings', 'ayarlar'] },
    { name: t('search.security', 'Security'), path: '/settings/security', icon: '🔐', keywords: ['security', 'tehlukesizlik'] },
    { name: t('search.sso', 'Enterprise SSO'), path: '/settings/sso', icon: '🛡️', keywords: ['sso', 'enterprise'] },
    { name: t('search.team', 'Team'), path: '/team', icon: '👥', keywords: ['team', 'komanda'] },
    { name: t('search.organization', 'Organization'), path: '/organizations/settings', icon: '🏢', keywords: ['org', 'teskilat'] },
    { name: t('search.recovery', 'Recovery Dashboard'), path: '/recovery', icon: '📈', keywords: ['recovery', 'berpa'] },
    { name: t('search.analytics', 'Analytics'), path: '/analytics', icon: '📊', keywords: ['analytics', 'analitika'] },
    { name: t('search.adminDashboard', 'Admin Dashboard'), path: '/admin/dashboard', icon: '👔', keywords: ['admin', 'idareetme'] },
  ];

  // Keyboard shortcut (Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Search bots from API
  const searchBots = useCallback(async (searchQuery) => {
    if (!searchQuery.trim()) {
      setResults({ bots: [], pages: [] });
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/bots`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const bots = (data.bots || data || []).filter(bot =>
          bot.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          bot.description?.toLowerCase().includes(searchQuery.toLowerCase())
        ).slice(0, 5);

        // Filter pages
        const filteredPages = pages.filter(page =>
          page.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          page.keywords.some(kw => kw.toLowerCase().includes(searchQuery.toLowerCase()))
        ).slice(0, 5);

        setResults({ bots, pages: filteredPages });
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchBots(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, searchBots]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    const totalResults = results.bots.length + results.pages.length;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % totalResults);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + totalResults) % totalResults);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelect(selectedIndex);
    }
  };

  // Select result
  const handleSelect = (index) => {
    if (index < results.bots.length) {
      const bot = results.bots[index];
      navigate(`/bot/${bot.id}/edit`);
    } else {
      const pageIndex = index - results.bots.length;
      const page = results.pages[pageIndex];
      if (page) navigate(page.path);
    }
    setIsOpen(false);
    setQuery('');
    setResults({ bots: [], pages: [] });
  };

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <>
      {/* Search Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg transition-colors text-gray-500 dark:text-gray-400 text-sm"
        aria-label={t('search.openSearch', 'Open search')}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="hidden md:inline">{t('search.search', 'Search...')}</span>
        <kbd className="hidden lg:inline px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-slate-600 rounded">
          Ctrl+K
        </kbd>
      </button>

      {/* Mobile Search Icon */}
      <button
        onClick={() => setIsOpen(true)}
        className="sm:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
        aria-label={t('search.openSearch', 'Open search')}
      >
        <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>

      {/* Search Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Modal */}
          <div
            ref={modalRef}
            className="relative w-full max-w-xl bg-white dark:bg-slate-800 rounded-xl shadow-2xl overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label={t('search.searchModal', 'Search modal')}
          >
            {/* Search Input */}
            <div className="flex items-center border-b border-gray-200 dark:border-slate-700">
              <svg className="w-5 h-5 ml-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('search.placeholder', 'Search bots, pages...')}
                className="flex-1 px-4 py-4 bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder-gray-400"
              />
              {loading && (
                <div className="mr-4">
                  <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="mr-2 px-2 py-1 text-xs text-gray-500 bg-gray-100 dark:bg-slate-700 rounded"
              >
                ESC
              </button>
            </div>

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto">
              {/* Bots Section */}
              {results.bots.length > 0 && (
                <div className="p-2">
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    {t('search.bots', 'Bots')}
                  </div>
                  {results.bots.map((bot, index) => (
                    <button
                      key={bot.id}
                      onClick={() => handleSelect(index)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        selectedIndex === index
                          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                          : 'hover:bg-gray-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span className="text-xl">🤖</span>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-gray-900 dark:text-white">{bot.name}</div>
                        {bot.description && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                            {bot.description}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">→</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Pages Section */}
              {results.pages.length > 0 && (
                <div className="p-2 border-t border-gray-200 dark:border-slate-700">
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    {t('search.pages', 'Pages')}
                  </div>
                  {results.pages.map((page, index) => {
                    const actualIndex = results.bots.length + index;
                    return (
                      <button
                        key={page.path}
                        onClick={() => handleSelect(actualIndex)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                          selectedIndex === actualIndex
                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                            : 'hover:bg-gray-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        <span className="text-xl">{page.icon}</span>
                        <span className="flex-1 text-left font-medium text-gray-900 dark:text-white">
                          {page.name}
                        </span>
                        <span className="text-xs text-gray-400">→</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* No Results */}
              {query && !loading && results.bots.length === 0 && results.pages.length === 0 && (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <div className="text-4xl mb-2">🔍</div>
                  <div>{t('search.noResults', 'No results found')}</div>
                </div>
              )}

              {/* Empty State */}
              {!query && (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <div className="text-4xl mb-2">🔍</div>
                  <div>{t('search.hint', 'Start typing to search bots and pages')}</div>
                  <div className="mt-2 text-xs">
                    <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 rounded">↑</kbd>
                    <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 rounded ml-1">↓</kbd>
                    <span className="mx-2">{t('search.navigate', 'to navigate')}</span>
                    <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 rounded">Enter</kbd>
                    <span className="ml-2">{t('search.select', 'to select')}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
