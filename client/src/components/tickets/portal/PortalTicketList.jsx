/**
 * Portal Ticket List Component
 * List of customer tickets with filters
 */

import React, { useState, useMemo } from 'react';
import PortalTicketCard from './PortalTicketCard';

const PortalTicketList = ({ tickets, onViewTicket, onRefresh }) => {
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('updated');

  const statusFilters = [
    { id: 'all', label: 'All Tickets' },
    { id: 'open', label: 'Open' },
    { id: 'pending', label: 'Pending' },
    { id: 'resolved', label: 'Resolved' },
    { id: 'closed', label: 'Closed' },
  ];

  const sortOptions = [
    { id: 'updated', label: 'Last Updated' },
    { id: 'created', label: 'Date Created' },
    { id: 'status', label: 'Status' },
  ];

  // Filter and sort tickets
  const filteredTickets = useMemo(() => {
    let result = [...tickets];

    // Apply filter
    if (filter !== 'all') {
      result = result.filter((ticket) => ticket.status === filter);
    }

    // Apply sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'updated':
          return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
        case 'created':
          return new Date(b.createdAt) - new Date(a.createdAt);
        case 'status': {
          const statusOrder = { open: 0, pending: 1, resolved: 2, closed: 3 };
          return (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
        }
        default:
          return 0;
      }
    });

    return result;
  }, [tickets, filter, sortBy]);

  // Get counts for filters
  const getCounts = () => {
    const counts = { all: tickets.length };
    tickets.forEach((ticket) => {
      counts[ticket.status] = (counts[ticket.status] || 0) + 1;
    });
    return counts;
  };

  const counts = getCounts();

  if (tickets.length === 0) {
    return (
      <div style={styles.emptyState}>
        <div style={styles.emptyIcon}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <h3 style={styles.emptyTitle}>No tickets yet</h3>
        <p style={styles.emptyText}>
          You haven't submitted any support tickets. When you do, they'll appear here.
        </p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        {/* Filter Tabs */}
        <div style={styles.filters}>
          {statusFilters.map((f) => (
            <button
              key={f.id}
              style={{
                ...styles.filterButton,
                ...(filter === f.id && styles.filterButtonActive),
              }}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
              {counts[f.id] > 0 && (
                <span
                  style={{
                    ...styles.filterCount,
                    ...(filter === f.id && styles.filterCountActive),
                  }}
                >
                  {counts[f.id]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div style={styles.actions}>
          {/* Sort Dropdown */}
          <div style={styles.sortContainer}>
            <label style={styles.sortLabel}>Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={styles.sortSelect}
            >
              {sortOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh Button */}
          <button style={styles.refreshButton} onClick={onRefresh} title="Refresh">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Results Count */}
      <div style={styles.resultsInfo}>
        Showing {filteredTickets.length} of {tickets.length} tickets
      </div>

      {/* Ticket List */}
      <div style={styles.list}>
        {filteredTickets.length > 0 ? (
          filteredTickets.map((ticket) => (
            <PortalTicketCard
              key={ticket.id}
              ticket={ticket}
              onClick={onViewTicket}
            />
          ))
        ) : (
          <div style={styles.noResults}>
            <p style={styles.noResultsText}>
              No {filter !== 'all' ? filter : ''} tickets found.
            </p>
            <button
              style={styles.clearFilterButton}
              onClick={() => setFilter('all')}
            >
              Show all tickets
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '16px',
  },
  filters: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flexWrap: 'wrap',
  },
  filterButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '500',
    color: '#6b7280',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  filterButtonActive: {
    backgroundColor: '#7c3aed',
    color: '#fff',
  },
  filterCount: {
    padding: '2px 6px',
    backgroundColor: '#e5e7eb',
    borderRadius: '10px',
    fontSize: '11px',
    fontWeight: '600',
    color: '#6b7280',
  },
  filterCountActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    color: '#fff',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  sortContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  sortLabel: {
    fontSize: '13px',
    color: '#6b7280',
  },
  sortSelect: {
    padding: '6px 10px',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    fontSize: '13px',
    backgroundColor: '#fff',
    color: '#374151',
    cursor: 'pointer',
  },
  refreshButton: {
    padding: '8px',
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    color: '#6b7280',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsInfo: {
    fontSize: '13px',
    color: '#9ca3af',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '48px 24px',
  },
  emptyIcon: {
    width: '80px',
    height: '80px',
    backgroundColor: '#f3f4f6',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
    color: '#9ca3af',
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '8px',
  },
  emptyText: {
    fontSize: '14px',
    color: '#6b7280',
    margin: 0,
    maxWidth: '300px',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  noResults: {
    textAlign: 'center',
    padding: '32px',
    backgroundColor: '#f9fafb',
    borderRadius: '12px',
    border: '1px dashed #e5e7eb',
  },
  noResultsText: {
    fontSize: '14px',
    color: '#6b7280',
    marginBottom: '12px',
  },
  clearFilterButton: {
    padding: '8px 16px',
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#7c3aed',
    fontWeight: '500',
    cursor: 'pointer',
  },
};

export default PortalTicketList;
