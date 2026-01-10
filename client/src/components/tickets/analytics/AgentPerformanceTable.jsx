/**
 * Agent Performance Table Component
 * Sortable table showing agent metrics
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronUp, ChevronDown, User, Star } from 'lucide-react';

export default function AgentPerformanceTable({ data, isLoading, onAgentClick }) {
  const { t } = useTranslation();
  const [sortField, setSortField] = useState('resolved');
  const [sortOrder, setSortOrder] = useState('desc');

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div className="p-6">
          <div className="h-6 w-40 bg-gray-200 dark:bg-slate-700 rounded animate-pulse mb-4" />
        </div>
        <div className="divide-y divide-gray-100 dark:divide-slate-700">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="p-4 flex items-center gap-4 animate-pulse">
              <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-full" />
              <div className="flex-1">
                <div className="h-4 w-24 bg-gray-200 dark:bg-slate-700 rounded" />
              </div>
              <div className="h-4 w-12 bg-gray-200 dark:bg-slate-700 rounded" />
              <div className="h-4 w-12 bg-gray-200 dark:bg-slate-700 rounded" />
              <div className="h-4 w-12 bg-gray-200 dark:bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const agents = data || [];

  const sortedAgents = [...agents].sort((a, b) => {
    const aVal = a[sortField] || 0;
    const bVal = b[sortField] || 0;
    return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  };

  const columns = [
    { key: 'name', label: t('tickets.analytics.agent', 'Agent'), sortable: false },
    { key: 'assigned', label: t('tickets.analytics.assigned', 'Assigned'), sortable: true },
    { key: 'resolved', label: t('tickets.analytics.resolved', 'Resolved'), sortable: true },
    { key: 'avgResponseTime', label: t('tickets.analytics.avgResp', 'Avg Resp'), sortable: true },
    { key: 'avgResolutionTime', label: t('tickets.analytics.avgResol', 'Avg Resol'), sortable: true },
    { key: 'csatScore', label: t('tickets.analytics.csat', 'CSAT'), sortable: true }
  ];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
      <div className="p-6 border-b border-gray-100 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('tickets.analytics.agentPerformance', 'Agent Performance')}
        </h3>
      </div>

      {agents.length === 0 ? (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
          {t('tickets.analytics.noAgents', 'No agent data available')}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-slate-700/50">
              <tr>
                {columns.map(col => (
                  <th
                    key={col.key}
                    className={`px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${
                      col.sortable ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700' : ''
                    }`}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {col.sortable && <SortIcon field={col.key} />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {sortedAgents.map((agent, index) => (
                <tr
                  key={agent.agentId || index}
                  className="hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                  onClick={() => onAgentClick && onAgentClick(agent)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {agent.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {agent.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                    {agent.assigned}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                    {agent.resolved}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                    {agent.avgResponseTime?.toFixed(1)}h
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                    {agent.avgResolutionTime?.toFixed(1)}h
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {agent.csatScore?.toFixed(1) || '-'}
                      </span>
                      {agent.csatCount > 0 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          ({agent.csatCount})
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
