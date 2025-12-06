import React, { useState } from 'react';
import ToolCard from './ToolCard';

const ToolList = ({ tools, onEdit, onDelete, onTest, onCreate, onAssign }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  const toolTypes = [
    { value: 'all', label: 'All Types' },
    { value: 'http_request', label: 'HTTP/API' },
    { value: 'database_query', label: 'Database' },
    { value: 'code_execution', label: 'Code' },
    { value: 'web_scraper', label: 'Web Scraper' },
    { value: 'email', label: 'Email' }
  ];

  const filteredTools = tools.filter(tool => {
    const matchesSearch = tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tool.description && tool.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = filterType === 'all' || tool.tool_type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="tool-list">
      <div className="tool-list-header">
        <h2>Tools</h2>
        <button className="btn btn-primary" onClick={onCreate}>
          + Create New Tool
        </button>
      </div>

      <div className="tool-filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search tools..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="filter-select"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          {toolTypes.map(type => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </div>

      {filteredTools.length === 0 ? (
        <div className="tool-list-empty">
          <div className="empty-icon">🔧</div>
          <h3>{tools.length === 0 ? 'No Tools Yet' : 'No Matching Tools'}</h3>
          <p>
            {tools.length === 0
              ? 'Create your first tool to extend your agents with external capabilities.'
              : 'Try adjusting your search or filter criteria.'}
          </p>
          {tools.length === 0 && (
            <button className="btn btn-primary" onClick={onCreate}>
              Create Your First Tool
            </button>
          )}
        </div>
      ) : (
        <div className="tool-grid">
          {filteredTools.map((tool) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              onEdit={() => onEdit(tool)}
              onDelete={() => onDelete(tool)}
              onTest={() => onTest(tool)}
              onAssign={() => onAssign && onAssign(tool)}
            />
          ))}
        </div>
      )}

      <style>{`
        .tool-list {
          padding: 20px;
        }

        .tool-list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .tool-list-header h2 {
          margin: 0;
          font-size: 24px;
          color: #1a1a2e;
        }

        .tool-filters {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
        }

        .search-box {
          flex: 1;
        }

        .search-box input {
          width: 100%;
          padding: 10px 16px;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          font-size: 14px;
          transition: border-color 0.2s;
        }

        .search-box input:focus {
          outline: none;
          border-color: #667eea;
        }

        .filter-select {
          padding: 10px 16px;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          font-size: 14px;
          background: white;
          cursor: pointer;
          min-width: 150px;
        }

        .filter-select:focus {
          outline: none;
          border-color: #667eea;
        }

        .tool-list-empty {
          text-align: center;
          padding: 60px 20px;
          background: #f8f9fa;
          border-radius: 12px;
          border: 2px dashed #dee2e6;
        }

        .empty-icon {
          font-size: 64px;
          margin-bottom: 16px;
        }

        .tool-list-empty h3 {
          margin: 0 0 8px 0;
          color: #1a1a2e;
        }

        .tool-list-empty p {
          color: #6c757d;
          margin-bottom: 24px;
        }

        .tool-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 20px;
        }

        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }
      `}</style>
    </div>
  );
};

export default ToolList;
