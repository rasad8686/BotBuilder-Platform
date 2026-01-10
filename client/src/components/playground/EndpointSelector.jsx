import React, { useState, useMemo } from 'react';
import MethodBadge from './MethodBadge';

const endpoints = [
  // Bots
  { method: 'GET', path: '/api/bots', name: 'List Bots', category: 'Bots' },
  { method: 'POST', path: '/api/bots', name: 'Create Bot', category: 'Bots' },
  { method: 'GET', path: '/api/bots/:id', name: 'Get Bot', category: 'Bots' },
  { method: 'PUT', path: '/api/bots/:id', name: 'Update Bot', category: 'Bots' },
  { method: 'DELETE', path: '/api/bots/:id', name: 'Delete Bot', category: 'Bots' },
  { method: 'POST', path: '/api/bots/:id/clone', name: 'Clone Bot', category: 'Bots' },
  { method: 'GET', path: '/api/bots/:id/stats', name: 'Get Bot Stats', category: 'Bots' },

  // Messages
  { method: 'POST', path: '/api/messages', name: 'Send Message', category: 'Messages' },
  { method: 'GET', path: '/api/messages/:botId', name: 'Get Messages', category: 'Messages' },
  { method: 'GET', path: '/api/messages/:botId/conversations', name: 'List Conversations', category: 'Messages' },
  { method: 'DELETE', path: '/api/messages/:id', name: 'Delete Message', category: 'Messages' },

  // Agents
  { method: 'GET', path: '/api/agents', name: 'List Agents', category: 'Agents' },
  { method: 'POST', path: '/api/agents', name: 'Create Agent', category: 'Agents' },
  { method: 'GET', path: '/api/agents/:id', name: 'Get Agent', category: 'Agents' },
  { method: 'PUT', path: '/api/agents/:id', name: 'Update Agent', category: 'Agents' },
  { method: 'DELETE', path: '/api/agents/:id', name: 'Delete Agent', category: 'Agents' },
  { method: 'POST', path: '/api/agents/:id/execute', name: 'Execute Agent', category: 'Agents' },

  // Knowledge Base
  { method: 'GET', path: '/api/knowledge', name: 'List Documents', category: 'Knowledge' },
  { method: 'POST', path: '/api/knowledge', name: 'Upload Document', category: 'Knowledge' },
  { method: 'GET', path: '/api/knowledge/:id', name: 'Get Document', category: 'Knowledge' },
  { method: 'DELETE', path: '/api/knowledge/:id', name: 'Delete Document', category: 'Knowledge' },
  { method: 'POST', path: '/api/knowledge/search', name: 'Search Knowledge', category: 'Knowledge' },

  // Users
  { method: 'GET', path: '/api/users/me', name: 'Get Current User', category: 'Users' },
  { method: 'PUT', path: '/api/users/me', name: 'Update Profile', category: 'Users' },
  { method: 'GET', path: '/api/users/usage', name: 'Get Usage Stats', category: 'Users' },

  // Workflows
  { method: 'GET', path: '/api/workflows', name: 'List Workflows', category: 'Workflows' },
  { method: 'POST', path: '/api/workflows', name: 'Create Workflow', category: 'Workflows' },
  { method: 'GET', path: '/api/workflows/:id', name: 'Get Workflow', category: 'Workflows' },
  { method: 'PUT', path: '/api/workflows/:id', name: 'Update Workflow', category: 'Workflows' },
  { method: 'DELETE', path: '/api/workflows/:id', name: 'Delete Workflow', category: 'Workflows' },
  { method: 'POST', path: '/api/workflows/:id/execute', name: 'Execute Workflow', category: 'Workflows' },

  // Channels
  { method: 'GET', path: '/api/channels', name: 'List Channels', category: 'Channels' },
  { method: 'POST', path: '/api/channels/connect', name: 'Connect Channel', category: 'Channels' },
  { method: 'DELETE', path: '/api/channels/:id', name: 'Disconnect Channel', category: 'Channels' },

  // Analytics
  { method: 'GET', path: '/api/analytics/overview', name: 'Get Overview', category: 'Analytics' },
  { method: 'GET', path: '/api/analytics/conversations', name: 'Conversation Analytics', category: 'Analytics' },
  { method: 'GET', path: '/api/analytics/performance', name: 'Performance Metrics', category: 'Analytics' },

  // API Tokens
  { method: 'GET', path: '/api/tokens', name: 'List Tokens', category: 'API Tokens' },
  { method: 'POST', path: '/api/tokens', name: 'Create Token', category: 'API Tokens' },
  { method: 'DELETE', path: '/api/tokens/:id', name: 'Revoke Token', category: 'API Tokens' },

  // Webhooks
  { method: 'GET', path: '/api/webhooks', name: 'List Webhooks', category: 'Webhooks' },
  { method: 'POST', path: '/api/webhooks', name: 'Create Webhook', category: 'Webhooks' },
  { method: 'PUT', path: '/api/webhooks/:id', name: 'Update Webhook', category: 'Webhooks' },
  { method: 'DELETE', path: '/api/webhooks/:id', name: 'Delete Webhook', category: 'Webhooks' },
];

const categories = ['All', 'Bots', 'Messages', 'Agents', 'Knowledge', 'Users', 'Workflows', 'Channels', 'Analytics', 'API Tokens', 'Webhooks'];

export default function EndpointSelector({ selectedEndpoint, onSelect }) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredEndpoints = useMemo(() => {
    return endpoints.filter(ep => {
      const matchesSearch =
        ep.name.toLowerCase().includes(search.toLowerCase()) ||
        ep.path.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || ep.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [search, selectedCategory]);

  const groupedEndpoints = useMemo(() => {
    const groups = {};
    filteredEndpoints.forEach(ep => {
      if (!groups[ep.category]) {
        groups[ep.category] = [];
      }
      groups[ep.category].push(ep);
    });
    return groups;
  }, [filteredEndpoints]);

  return (
    <div className="h-full flex flex-col bg-gray-900 border-r border-gray-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-3">API Endpoints</h2>

        {/* Search */}
        <div className="relative mb-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search endpoints..."
            className="w-full px-3 py-2 pl-9 text-sm rounded-lg border bg-gray-800 border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Category Dropdown */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg border bg-gray-800 border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Endpoint List */}
      <div className="flex-1 overflow-y-auto p-2">
        {Object.entries(groupedEndpoints).map(([category, eps]) => (
          <div key={category} className="mb-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-2">
              {category}
            </h3>
            <div className="space-y-1">
              {eps.map((ep, idx) => {
                const isSelected = selectedEndpoint?.path === ep.path && selectedEndpoint?.method === ep.method;
                return (
                  <button
                    key={`${ep.method}-${ep.path}-${idx}`}
                    onClick={() => onSelect(ep)}
                    className={`
                      w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left
                      transition-colors duration-150
                      ${isSelected
                        ? 'bg-purple-600 text-white'
                        : 'text-gray-300 hover:bg-gray-800'
                      }
                    `}
                  >
                    <MethodBadge method={ep.method} size="sm" />
                    <span className="text-sm truncate flex-1">{ep.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {filteredEndpoints.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <p>No endpoints found</p>
          </div>
        )}
      </div>
    </div>
  );
}
