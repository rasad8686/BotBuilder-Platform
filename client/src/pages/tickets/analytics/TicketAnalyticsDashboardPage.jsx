/**
 * Ticket Analytics Dashboard Page
 * Main analytics dashboard with tabs for different views
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  Users,
  Clock,
  Star,
  Download,
  Calendar,
  RefreshCw
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Input';
import {
  TicketSummaryCards,
  TicketVolumeChart,
  TicketsByStatusChart,
  TicketsByPriorityChart,
  AgentPerformanceTable,
  SLAComplianceGauge,
  CSATDistributionChart,
  RecentFeedbackList
} from '../../../components/tickets/analytics';
import {
  useTicketAnalyticsOverview,
  useTicketVolumeQuery,
  useTicketDistributionQuery,
  useAgentPerformanceQuery,
  useSLAPerformanceQuery,
  useCSATQuery,
  useAnalyticsExport
} from '../../../hooks/tickets/useTicketAnalytics';

const TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'agents', label: 'Agents', icon: Users },
  { id: 'sla', label: 'SLA', icon: Clock },
  { id: 'satisfaction', label: 'Satisfaction', icon: Star }
];

const PERIOD_OPTIONS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' }
];

export default function TicketAnalyticsDashboardPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('overview');
  const [period, setPeriod] = useState('30d');

  const dateRange = { period };

  // Queries
  const overview = useTicketAnalyticsOverview(dateRange);
  const volume = useTicketVolumeQuery(dateRange);
  const statusDist = useTicketDistributionQuery(dateRange, 'status');
  const priorityDist = useTicketDistributionQuery(dateRange, 'priority');
  const agents = useAgentPerformanceQuery(dateRange);
  const sla = useSLAPerformanceQuery(dateRange);
  const csat = useCSATQuery(dateRange);
  const exportMutation = useAnalyticsExport();

  const handleExport = async (format = 'csv') => {
    await exportMutation.mutateAsync({ dateRange, format });
  };

  const handleRefresh = () => {
    overview.refetch();
    volume.refetch();
    statusDist.refetch();
    priorityDist.refetch();
    agents.refetch();
    sla.refetch();
    csat.refetch();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-blue-600" />
            {t('tickets.analytics.title', 'Helpdesk Analytics')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('tickets.analytics.subtitle', 'Monitor ticket performance and team metrics')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            options={PERIOD_OPTIONS}
            className="w-40"
          />
          <Button
            variant="outline"
            icon={RefreshCw}
            onClick={handleRefresh}
            className="shrink-0"
          >
            {t('common.refresh', 'Refresh')}
          </Button>
          <Button
            variant="outline"
            icon={Download}
            onClick={() => handleExport('csv')}
            loading={exportMutation.isPending}
            className="shrink-0"
          >
            {t('common.export', 'Export')}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <TicketSummaryCards data={overview.data} isLoading={overview.isLoading} />

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-slate-700">
        <nav className="flex gap-4">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {t(`tickets.analytics.tabs.${tab.id}`, tab.label)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Volume Chart */}
          <TicketVolumeChart data={volume.data} isLoading={volume.isLoading} />

          {/* Distribution Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TicketsByStatusChart data={statusDist.data} isLoading={statusDist.isLoading} />
            <TicketsByPriorityChart data={priorityDist.data} isLoading={priorityDist.isLoading} />
          </div>
        </div>
      )}

      {activeTab === 'agents' && (
        <div className="space-y-6">
          <AgentPerformanceTable
            data={agents.data}
            isLoading={agents.isLoading}
          />
        </div>
      )}

      {activeTab === 'sla' && (
        <div className="space-y-6">
          {/* SLA Gauges */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-slate-700 flex justify-center">
              <SLAComplianceGauge
                value={sla.data?.overall || 0}
                title={t('tickets.analytics.overallSLA', 'Overall SLA')}
                size="lg"
              />
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-slate-700 flex justify-center">
              <SLAComplianceGauge
                value={sla.data?.firstResponse || 0}
                title={t('tickets.analytics.firstResponse', 'First Response')}
                size="lg"
              />
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-slate-700 flex justify-center">
              <SLAComplianceGauge
                value={sla.data?.resolution || 0}
                title={t('tickets.analytics.resolution', 'Resolution')}
                size="lg"
              />
            </div>
          </div>

          {/* SLA by Priority */}
          {sla.data?.byPriority && (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {t('tickets.analytics.slaByPriority', 'SLA by Priority')}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-slate-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        {t('tickets.priority', 'Priority')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        {t('tickets.analytics.targetResp', 'Target Resp')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        {t('tickets.analytics.actualResp', 'Actual Resp')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        {t('tickets.analytics.targetRes', 'Target Res')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        {t('tickets.analytics.actualRes', 'Actual Res')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {sla.data.byPriority.map((item, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white capitalize">
                          {item.priority}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {item.targetResp}m
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={item.actualResp <= item.targetResp ? 'text-green-600' : 'text-red-600'}>
                            {item.actualResp}m {item.actualResp <= item.targetResp ? '✓' : '✗'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {item.targetRes}m
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={item.actualRes <= item.targetRes ? 'text-green-600' : 'text-red-600'}>
                            {item.actualRes}m {item.actualRes <= item.targetRes ? '✓' : '✗'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Breached Tickets */}
          {sla.data?.breached && sla.data.breached.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {t('tickets.analytics.breachedTickets', 'Breached Tickets')}
              </h3>
              <div className="space-y-2">
                {sla.data.breached.slice(0, 10).map((ticket, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {ticket.ticketNumber}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
                        {ticket.subject}
                      </span>
                    </div>
                    <div className="text-sm text-red-600 dark:text-red-400">
                      +{ticket.breachDuration}m ({ticket.type})
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'satisfaction' && (
        <div className="space-y-6">
          {/* CSAT Score Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-slate-700 text-center">
              <div className="flex items-center justify-center gap-1 mb-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star
                    key={star}
                    className={`w-6 h-6 ${
                      star <= Math.round(csat.data?.score || 0)
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-gray-300 dark:text-gray-600'
                    }`}
                  />
                ))}
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {csat.data?.score?.toFixed(1) || '0.0'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('tickets.analytics.csatScore', 'CSAT Score')}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-slate-700 text-center">
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {csat.data?.totalRatings || 0}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('tickets.analytics.totalRatings', 'Total Ratings')}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-slate-700 text-center">
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {csat.data?.responseRate || 0}%
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('tickets.analytics.responseRate', 'Response Rate')}
              </p>
            </div>
          </div>

          {/* Distribution and Feedback */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CSATDistributionChart
              data={csat.data?.distribution}
              isLoading={csat.isLoading}
            />
            <RecentFeedbackList
              data={csat.data?.recentFeedback}
              isLoading={csat.isLoading}
            />
          </div>

          {/* CSAT by Agent */}
          {csat.data?.byAgent && csat.data.byAgent.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {t('tickets.analytics.csatByAgent', 'CSAT by Agent')}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-slate-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        {t('tickets.agent', 'Agent')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        {t('tickets.analytics.ratings', 'Ratings')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        {t('tickets.analytics.avgScore', 'Avg Score')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {csat.data.byAgent.map((agent, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                          {agent.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {agent.count}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {agent.avgScore?.toFixed(1)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
