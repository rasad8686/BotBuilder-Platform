import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import debounce from 'lodash.debounce';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const PluginSearch = ({
  onSearch,
  onResults,
  placeholder = 'Search plugins...',
  showSuggestions = true,
  autoFocus = false,
  className = ''
}) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Debounced search for suggestions
  const fetchSuggestions = useCallback(
    debounce(async (searchQuery) => {
      if (!searchQuery || searchQuery.length < 2) {
        setSuggestions([]);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(
          `${API_URL}/api/plugins/search?q=${encodeURIComponent(searchQuery)}&limit=5`
        );
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data);
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  useEffect(() => {
    if (showSuggestions && query.length >= 2) {
      fetchSuggestions(query);
    } else {
      setSuggestions([]);
    }
  }, [query, showSuggestions]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    setSelectedIndex(-1);
  };

  const handleSearch = async () => {
    if (!query.trim()) return;

    if (onSearch) {
      onSearch(query);
    }

    if (onResults) {
      setLoading(true);
      try {
        const response = await fetch(
          `${API_URL}/api/plugins/search?q=${encodeURIComponent(query)}`
        );
        if (response.ok) {
          const data = await response.json();
          onResults(data);
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    }

    setSuggestions([]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        navigate(`/plugins/${suggestions[selectedIndex].id}`);
        setSuggestions([]);
      } else {
        handleSearch();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Escape') {
      setSuggestions([]);
      setFocused(false);
      inputRef.current?.blur();
    }
  };

  const handleSuggestionClick = (plugin) => {
    navigate(`/plugins/${plugin.id}`);
    setSuggestions([]);
    setQuery('');
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    inputRef.current?.focus();
  };

  const showDropdown = focused && (suggestions.length > 0 || loading);

  return (
    <div className={`plugin-search ${className}`}>
      <div className="search-input-wrapper">
        <span className="search-icon">&#128269;</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          placeholder={placeholder}
          autoFocus={autoFocus}
        />
        {loading && (
          <span className="loading-spinner"></span>
        )}
        {query && !loading && (
          <button className="clear-btn" onClick={handleClear}>
            &times;
          </button>
        )}
        <button className="search-btn" onClick={handleSearch}>
          Search
        </button>
      </div>

      {showDropdown && (
        <div className="suggestions-dropdown" ref={suggestionsRef}>
          {loading ? (
            <div className="suggestion-loading">Searching...</div>
          ) : suggestions.length > 0 ? (
            suggestions.map((plugin, index) => (
              <div
                key={plugin.id}
                className={`suggestion-item ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => handleSuggestionClick(plugin)}
              >
                <div className="suggestion-icon">
                  {plugin.icon_url ? (
                    <img src={plugin.icon_url} alt="" />
                  ) : (
                    <span>&#129513;</span>
                  )}
                </div>
                <div className="suggestion-info">
                  <span className="suggestion-name">{plugin.name}</span>
                  <span className="suggestion-category">{plugin.category_name || 'General'}</span>
                </div>
                <div className="suggestion-meta">
                  {plugin.is_free ? (
                    <span className="free-badge">Free</span>
                  ) : (
                    <span className="price">${plugin.price}</span>
                  )}
                </div>
              </div>
            ))
          ) : null}
        </div>
      )}

      <style>{`
        .plugin-search {
          position: relative;
          width: 100%;
        }

        .search-input-wrapper {
          display: flex;
          align-items: center;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          overflow: hidden;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .search-input-wrapper:focus-within {
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .search-icon {
          padding: 0 12px;
          font-size: 18px;
          color: #9ca3af;
        }

        .search-input-wrapper input {
          flex: 1;
          padding: 14px 0;
          border: none;
          font-size: 15px;
          outline: none;
        }

        .search-input-wrapper input::placeholder {
          color: #9ca3af;
        }

        .loading-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid #e5e7eb;
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
          margin: 0 12px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .clear-btn {
          background: none;
          border: none;
          font-size: 20px;
          color: #9ca3af;
          cursor: pointer;
          padding: 0 12px;
        }

        .clear-btn:hover {
          color: #6b7280;
        }

        .search-btn {
          padding: 14px 24px;
          background: #667eea;
          color: white;
          border: none;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .search-btn:hover {
          background: #5a6fd6;
        }

        .suggestions-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          margin-top: 4px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.1);
          z-index: 100;
          overflow: hidden;
        }

        .suggestion-loading {
          padding: 16px;
          text-align: center;
          color: #6b7280;
        }

        .suggestion-item {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          gap: 12px;
          cursor: pointer;
          transition: background 0.15s;
        }

        .suggestion-item:hover,
        .suggestion-item.selected {
          background: #f3f4f6;
        }

        .suggestion-icon {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          flex-shrink: 0;
        }

        .suggestion-icon img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .suggestion-icon span {
          font-size: 18px;
          color: white;
        }

        .suggestion-info {
          flex: 1;
        }

        .suggestion-name {
          display: block;
          font-weight: 600;
          color: #1a1a2e;
        }

        .suggestion-category {
          font-size: 12px;
          color: #9ca3af;
        }

        .suggestion-meta .free-badge {
          color: #10b981;
          font-weight: 600;
          font-size: 13px;
        }

        .suggestion-meta .price {
          color: #667eea;
          font-weight: 600;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
};

export default PluginSearch;
