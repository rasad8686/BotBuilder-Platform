import React from 'react';

const PluginFilters = ({
  categories,
  selectedCategory,
  onCategoryChange,
  priceFilter,
  onPriceChange,
  sortBy,
  onSortChange,
  searchQuery,
  onSearchChange
}) => {
  return (
    <div className="plugin-filters">
      <div className="search-box">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          placeholder="Search plugins..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {searchQuery && (
          <button className="clear-btn" onClick={() => onSearchChange('')}>
            ×
          </button>
        )}
      </div>

      <div className="filter-row">
        <div className="filter-group">
          <label>Category</label>
          <select
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.slug}>
                {cat.icon} {cat.name} ({cat.plugin_count || 0})
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Price</label>
          <select
            value={priceFilter}
            onChange={(e) => onPriceChange(e.target.value)}
          >
            <option value="all">All Prices</option>
            <option value="free">Free Only</option>
            <option value="paid">Paid Only</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Sort By</label>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
          >
            <option value="downloads">Most Popular</option>
            <option value="rating">Highest Rated</option>
            <option value="created_at">Newest</option>
            <option value="name">Name A-Z</option>
          </select>
        </div>
      </div>

      <style>{`
        .plugin-filters {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          margin-bottom: 24px;
        }

        .search-box {
          position: relative;
          margin-bottom: 16px;
        }

        .search-box input {
          width: 100%;
          padding: 12px 40px 12px 44px;
          border: 2px solid #e5e7eb;
          border-radius: 10px;
          font-size: 15px;
          transition: all 0.2s;
        }

        .search-box input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 18px;
        }

        .clear-btn {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          font-size: 20px;
          color: #9ca3af;
          cursor: pointer;
          padding: 4px 8px;
        }

        .clear-btn:hover {
          color: #6b7280;
        }

        .filter-row {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }

        .filter-group {
          flex: 1;
          min-width: 150px;
        }

        .filter-group label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .filter-group select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 14px;
          background: white;
          cursor: pointer;
          transition: all 0.2s;
        }

        .filter-group select:focus {
          outline: none;
          border-color: #667eea;
        }

        @media (max-width: 640px) {
          .filter-row {
            flex-direction: column;
          }

          .filter-group {
            min-width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default PluginFilters;
