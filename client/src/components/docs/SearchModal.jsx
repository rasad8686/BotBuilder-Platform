import { useState, useEffect, useRef, useMemo } from 'react';
import MiniSearch from 'minisearch';

export default function SearchModal({
  isOpen,
  onClose,
  categories,
  onNavigate
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState(() => {
    const saved = localStorage.getItem('docs_recent_searches');
    return saved ? JSON.parse(saved) : [];
  });

  const inputRef = useRef(null);
  const resultsRef = useRef(null);

  // Build search index
  const searchIndex = useMemo(() => {
    const miniSearch = new MiniSearch({
      fields: ['title', 'content', 'categoryTitle'],
      storeFields: ['id', 'title', 'categoryId', 'categoryTitle', 'categoryIcon'],
      searchOptions: {
        boost: { title: 2 },
        fuzzy: 0.2,
        prefix: true
      }
    });

    // Index all sections
    const documents = [];
    categories.forEach(cat => {
      cat.sections.forEach(section => {
        documents.push({
          id: `${cat.id}/${section.id}`,
          title: section.title,
          content: section.content,
          categoryId: cat.id,
          categoryTitle: cat.title,
          categoryIcon: cat.icon
        });
      });
    });

    miniSearch.addAll(documents);
    return miniSearch;
  }, [categories]);

  // Search results
  const results = useMemo(() => {
    if (!query.trim()) return [];

    const searchResults = searchIndex.search(query, { limit: 10 });
    return searchResults.map(result => ({
      ...result,
      sectionId: result.id.split('/')[1]
    }));
  }, [query, searchIndex]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev =>
            Math.min(prev + 1, (results.length || recentSearches.length) - 1)
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results.length > 0) {
            handleSelect(results[selectedIndex]);
          } else if (recentSearches.length > 0 && !query) {
            handleRecentSelect(recentSearches[selectedIndex]);
          }
          break;
        case 'Escape':
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, recentSearches, query, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current) {
      const selected = resultsRef.current.querySelector('[data-selected="true"]');
      if (selected) {
        selected.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const handleSelect = (result) => {
    // Save to recent searches
    const newRecent = [
      { query, categoryId: result.categoryId, sectionId: result.sectionId, title: result.title },
      ...recentSearches.filter(r => r.sectionId !== result.sectionId)
    ].slice(0, 5);

    setRecentSearches(newRecent);
    localStorage.setItem('docs_recent_searches', JSON.stringify(newRecent));

    onNavigate(result.categoryId, result.sectionId);
    onClose();
  };

  const handleRecentSelect = (recent) => {
    onNavigate(recent.categoryId, recent.sectionId);
    onClose();
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('docs_recent_searches');
  };

  // Highlight matching text
  const highlightMatch = (text, searchQuery) => {
    if (!searchQuery.trim()) return text;

    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5">
          {part}
        </mark>
      ) : part
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-xl mx-4 bg-white rounded-xl shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Search documentation"
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: '#e6ebf1' }}>
          <svg
            className="w-5 h-5 flex-shrink-0"
            style={{ color: '#8898aa' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search documentation..."
            className="flex-1 text-base outline-none"
            style={{ color: '#32325d' }}
            aria-label="Search documentation"
          />
          <kbd
            className="hidden sm:inline-flex items-center px-2 py-1 text-xs font-medium rounded"
            style={{ backgroundColor: '#f6f9fc', color: '#8898aa' }}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={resultsRef}
          className="max-h-[60vh] overflow-y-auto"
          role="listbox"
        >
          {query.trim() ? (
            results.length > 0 ? (
              <ul className="py-2">
                {results.map((result, index) => (
                  <li key={result.id}>
                    <button
                      onClick={() => handleSelect(result)}
                      data-selected={index === selectedIndex}
                      className="w-full px-4 py-3 text-left flex items-start gap-3 transition-colors"
                      style={{
                        backgroundColor: index === selectedIndex ? '#f6f9fc' : 'transparent'
                      }}
                      role="option"
                      aria-selected={index === selectedIndex}
                    >
                      <span className="text-lg flex-shrink-0">{result.categoryIcon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate" style={{ color: '#32325d' }}>
                          {highlightMatch(result.title, query)}
                        </div>
                        <div className="text-sm truncate" style={{ color: '#8898aa' }}>
                          {result.categoryTitle}
                        </div>
                      </div>
                      <svg
                        className="w-4 h-4 flex-shrink-0 mt-1"
                        style={{ color: '#8898aa' }}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-8 text-center" style={{ color: '#8898aa' }}>
                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>No results found for "{query}"</p>
                <p className="text-sm mt-1">Try different keywords or check the spelling</p>
              </div>
            )
          ) : recentSearches.length > 0 ? (
            <div className="py-2">
              <div className="flex items-center justify-between px-4 py-2">
                <span className="text-xs font-medium uppercase" style={{ color: '#8898aa' }}>
                  Recent Searches
                </span>
                <button
                  onClick={clearRecentSearches}
                  className="text-xs hover:underline"
                  style={{ color: '#635bff' }}
                >
                  Clear
                </button>
              </div>
              <ul>
                {recentSearches.map((recent, index) => (
                  <li key={recent.sectionId}>
                    <button
                      onClick={() => handleRecentSelect(recent)}
                      data-selected={index === selectedIndex}
                      className="w-full px-4 py-3 text-left flex items-center gap-3 transition-colors"
                      style={{
                        backgroundColor: index === selectedIndex ? '#f6f9fc' : 'transparent'
                      }}
                      role="option"
                      aria-selected={index === selectedIndex}
                    >
                      <svg
                        className="w-4 h-4 flex-shrink-0"
                        style={{ color: '#8898aa' }}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="flex-1 truncate" style={{ color: '#32325d' }}>
                        {recent.title}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="px-4 py-8 text-center" style={{ color: '#8898aa' }}>
              <p>Start typing to search documentation</p>
              <p className="text-sm mt-1">Use arrow keys to navigate, Enter to select</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-4 py-2 border-t flex items-center justify-between text-xs"
          style={{ borderColor: '#e6ebf1', color: '#8898aa' }}
        >
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded" style={{ backgroundColor: '#f6f9fc' }}>↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded" style={{ backgroundColor: '#f6f9fc' }}>↓</kbd>
              <span>to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded" style={{ backgroundColor: '#f6f9fc' }}>↵</kbd>
              <span>to select</span>
            </span>
          </div>
          <span>Powered by fuzzy search</span>
        </div>
      </div>
    </div>
  );
}
