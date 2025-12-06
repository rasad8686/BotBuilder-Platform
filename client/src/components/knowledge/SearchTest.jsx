import React, { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const SearchTest = ({ knowledgeBaseId }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [searchMeta, setSearchMeta] = useState(null);

  const token = localStorage.getItem('token');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    setError(null);
    setResults([]);

    try {
      const response = await fetch(`${API_URL}/api/knowledge/${knowledgeBaseId}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          query: query.trim(),
          limit: 5,
          threshold: 0.5
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Search failed');
      }

      const data = await response.json();
      setResults(data.results || []);
      setSearchMeta({
        query: data.query,
        count: data.count
      });

    } catch (err) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  };

  const getSimilarityColor = (similarity) => {
    if (similarity >= 0.8) return '#10b981';
    if (similarity >= 0.6) return '#f59e0b';
    return '#6b7280';
  };

  const formatSimilarity = (similarity) => {
    return (similarity * 100).toFixed(1) + '%';
  };

  const highlightText = (text, maxLength = 300) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div className="search-test">
      <form onSubmit={handleSearch} className="search-form">
        <div className="search-input-wrapper">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Enter your search query..."
            disabled={searching}
          />
          <button type="submit" disabled={searching || !query.trim()}>
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>
        <p className="search-hint">
          Test semantic search to find relevant chunks from your documents
        </p>
      </form>

      {error && (
        <div className="search-error">
          {error}
        </div>
      )}

      {searchMeta && (
        <div className="search-meta">
          <span>Query: "{searchMeta.query}"</span>
          <span>{searchMeta.count} result{searchMeta.count !== 1 ? 's' : ''} found</span>
        </div>
      )}

      {results.length > 0 && (
        <div className="search-results">
          {results.map((result, index) => (
            <div key={result.id || index} className="result-card">
              <div className="result-header">
                <span className="result-rank">#{index + 1}</span>
                <span className="result-doc">
                  📄 {result.document_name}
                </span>
                <span
                  className="result-score"
                  style={{ color: getSimilarityColor(result.similarity) }}
                >
                  {formatSimilarity(result.similarity)} match
                </span>
              </div>

              <div className="result-content">
                {highlightText(result.content)}
              </div>

              <div className="result-meta">
                <span>Chunk #{result.chunk_index + 1}</span>
                <span>Type: {result.document_type}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {searchMeta && results.length === 0 && !error && (
        <div className="no-results">
          <span className="no-results-icon">🔍</span>
          <h4>No matching results</h4>
          <p>Try a different query or lower the similarity threshold</p>
        </div>
      )}

      <style>{`
        .search-test {
          padding: 12px 0;
        }

        .search-form {
          margin-bottom: 24px;
        }

        .search-input-wrapper {
          display: flex;
          gap: 12px;
        }

        .search-input-wrapper input {
          flex: 1;
          padding: 12px 16px;
          border: 2px solid #e5e7eb;
          border-radius: 10px;
          font-size: 15px;
          transition: border-color 0.2s;
        }

        .search-input-wrapper input:focus {
          outline: none;
          border-color: #667eea;
        }

        .search-input-wrapper button {
          padding: 12px 24px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .search-input-wrapper button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .search-input-wrapper button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .search-hint {
          margin: 8px 0 0 0;
          font-size: 13px;
          color: #6b7280;
        }

        .search-error {
          background: #fee2e2;
          color: #dc2626;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .search-meta {
          display: flex;
          justify-content: space-between;
          padding: 12px 16px;
          background: #f3f4f6;
          border-radius: 8px;
          margin-bottom: 16px;
          font-size: 14px;
          color: #6b7280;
        }

        .search-results {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .result-card {
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          overflow: hidden;
          transition: box-shadow 0.2s;
        }

        .result-card:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }

        .result-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
        }

        .result-rank {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 4px 10px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 12px;
        }

        .result-doc {
          flex: 1;
          font-weight: 500;
          color: #1a1a2e;
        }

        .result-score {
          font-weight: 600;
          font-size: 14px;
        }

        .result-content {
          padding: 16px;
          font-size: 14px;
          line-height: 1.6;
          color: #374151;
          background: white;
        }

        .result-meta {
          display: flex;
          gap: 16px;
          padding: 10px 16px;
          background: #f9fafb;
          border-top: 1px solid #e5e7eb;
          font-size: 12px;
          color: #6b7280;
        }

        .no-results {
          text-align: center;
          padding: 48px 24px;
          color: #6b7280;
        }

        .no-results-icon {
          font-size: 48px;
          display: block;
          margin-bottom: 12px;
        }

        .no-results h4 {
          margin: 0 0 8px 0;
          color: #374151;
        }

        .no-results p {
          margin: 0;
        }
      `}</style>
    </div>
  );
};

export default SearchTest;
