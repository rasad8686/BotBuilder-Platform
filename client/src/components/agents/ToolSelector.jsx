import React, { useState, useEffect } from 'react';

const defaultTools = [
  { id: 'web_search', name: 'Web Search', icon: '🌐', description: 'Search the web for information', category: 'research' },
  { id: 'analyze_text', name: 'Text Analysis', icon: '📝', description: 'Analyze and extract info from text', category: 'analysis' },
  { id: 'format_data', name: 'Data Formatter', icon: '📋', description: 'Format data into structured output', category: 'utility' },
  { id: 'calculate', name: 'Calculator', icon: '🔢', description: 'Perform mathematical calculations', category: 'utility' },
  { id: 'generate_list', name: 'List Generator', icon: '📑', description: 'Generate formatted lists', category: 'utility' },
  { id: 'save_note', name: 'Save Note', icon: '💾', description: 'Save notes for later use', category: 'memory' },
  { id: 'get_note', name: 'Get Note', icon: '📖', description: 'Retrieve saved notes', category: 'memory' },
  { id: 'http_request', name: 'HTTP Request', icon: '🔗', description: 'Make HTTP API calls', category: 'integration' },
  { id: 'send_email', name: 'Send Email', icon: '📧', description: 'Send email notifications', category: 'integration' },
  { id: 'browser', name: 'Browser', icon: '🖥️', description: 'Browse and scrape web pages', category: 'research' }
];

const categoryLabels = {
  research: 'Research',
  analysis: 'Analysis',
  utility: 'Utility',
  memory: 'Memory',
  integration: 'Integration'
};

const ToolSelector = ({
  selectedTools = [],
  onToolsChange,
  availableTools = defaultTools,
  maxTools = 10,
  showCategories = true
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);

  const handleToggle = (toolId) => {
    if (selectedTools.includes(toolId)) {
      onToolsChange(selectedTools.filter(id => id !== toolId));
    } else {
      if (selectedTools.length < maxTools) {
        onToolsChange([...selectedTools, toolId]);
      }
    }
  };

  const filteredTools = availableTools.filter(tool => {
    const matchesSearch = !searchQuery ||
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !activeCategory || tool.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = [...new Set(availableTools.map(t => t.category))];

  return (
    <div className="tool-selector">
      {/* Search and Filter */}
      <div className="tool-selector-header">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="selected-count">
          {selectedTools.length}/{maxTools} selected
        </div>
      </div>

      {/* Categories */}
      {showCategories && (
        <div className="category-tabs">
          <button
            className={`category-tab ${!activeCategory ? 'active' : ''}`}
            onClick={() => setActiveCategory(null)}
          >
            All
          </button>
          {categories.map(category => (
            <button
              key={category}
              className={`category-tab ${activeCategory === category ? 'active' : ''}`}
              onClick={() => setActiveCategory(category)}
            >
              {categoryLabels[category] || category}
            </button>
          ))}
        </div>
      )}

      {/* Tools Grid */}
      <div className="tools-grid">
        {filteredTools.map(tool => (
          <button
            key={tool.id}
            className={`tool-item ${selectedTools.includes(tool.id) ? 'selected' : ''}`}
            onClick={() => handleToggle(tool.id)}
            disabled={!selectedTools.includes(tool.id) && selectedTools.length >= maxTools}
          >
            <div className="tool-icon">{tool.icon}</div>
            <div className="tool-info">
              <div className="tool-name">{tool.name}</div>
              <div className="tool-description">{tool.description}</div>
            </div>
            <div className="tool-checkbox">
              {selectedTools.includes(tool.id) ? '✓' : ''}
            </div>
          </button>
        ))}
      </div>

      {/* Selected Tools Summary */}
      {selectedTools.length > 0 && (
        <div className="selected-summary">
          <span className="summary-label">Selected:</span>
          <div className="selected-chips">
            {selectedTools.map(toolId => {
              const tool = availableTools.find(t => t.id === toolId);
              return (
                <span key={toolId} className="tool-chip">
                  {tool?.icon} {tool?.name}
                  <button onClick={() => handleToggle(toolId)}>×</button>
                </span>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        .tool-selector {
          background: white;
          border-radius: 12px;
          padding: 20px;
        }

        .tool-selector-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .search-box {
          position: relative;
          flex: 1;
          max-width: 300px;
        }

        .search-box input {
          width: 100%;
          padding: 10px 10px 10px 36px;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          font-size: 14px;
        }

        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
        }

        .selected-count {
          font-size: 14px;
          color: #6c757d;
          font-weight: 500;
        }

        .category-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          overflow-x: auto;
          padding-bottom: 4px;
        }

        .category-tab {
          padding: 8px 16px;
          background: #f8f9fa;
          border: none;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 500;
          color: #6c757d;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s;
        }

        .category-tab:hover {
          background: #e9ecef;
        }

        .category-tab.active {
          background: #667eea;
          color: white;
        }

        .tools-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 12px;
          max-height: 400px;
          overflow-y: auto;
          padding: 4px;
        }

        .tool-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          background: #f8f9fa;
          border: 2px solid transparent;
          border-radius: 10px;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s;
        }

        .tool-item:hover:not(:disabled) {
          background: #e9ecef;
        }

        .tool-item.selected {
          background: linear-gradient(135deg, #667eea10 0%, #764ba210 100%);
          border-color: #667eea;
        }

        .tool-item:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .tool-icon {
          font-size: 24px;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;
          border-radius: 8px;
        }

        .tool-info {
          flex: 1;
        }

        .tool-name {
          font-weight: 600;
          color: #1a1a2e;
          font-size: 14px;
        }

        .tool-description {
          font-size: 12px;
          color: #6c757d;
          margin-top: 2px;
        }

        .tool-checkbox {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          border: 2px solid #e9ecef;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 14px;
          font-weight: 700;
        }

        .tool-item.selected .tool-checkbox {
          background: #667eea;
          border-color: #667eea;
        }

        .selected-summary {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #e9ecef;
        }

        .summary-label {
          font-size: 13px;
          color: #6c757d;
          font-weight: 500;
          margin-bottom: 8px;
          display: block;
        }

        .selected-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .tool-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background: #667eea20;
          color: #667eea;
          border-radius: 16px;
          font-size: 13px;
          font-weight: 500;
        }

        .tool-chip button {
          background: none;
          border: none;
          color: #667eea;
          cursor: pointer;
          padding: 0;
          font-size: 16px;
          line-height: 1;
        }
      `}</style>
    </div>
  );
};

export default ToolSelector;
