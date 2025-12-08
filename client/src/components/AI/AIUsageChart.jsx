import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import aiApi from '../../api/ai';

/**
 * AI Usage Chart
 * Displays AI usage statistics and costs
 */
export default function AIUsageChart() {
  const { botId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [usageData, setUsageData] = useState(null);
  const [timeRange, setTimeRange] = useState('all'); // 'all', 'week', 'month'

  useEffect(() => {
    loadUsageData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId, timeRange]);

  const loadUsageData = async () => {
    try {
      setLoading(true);
      setError('');

      // Calculate date range
      let params = { limit: 100 };
      if (timeRange === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        params.startDate = weekAgo.toISOString();
      } else if (timeRange === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        params.startDate = monthAgo.toISOString();
      }

      const response = await aiApi.getUsage(botId, params);
      setUsageData(response);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load usage data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="text-4xl mb-4 animate-pulse">📊</div>
        <div className="text-gray-600">Loading usage data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        ⚠️ {error}
      </div>
    );
  }

  const { summary, usage } = usageData;

  // Group usage by date
  const usageByDate = {};
  usage.forEach(item => {
    const date = new Date(item.created_at).toLocaleDateString();
    if (!usageByDate[date]) {
      usageByDate[date] = {
        requests: 0,
        tokens: 0,
        cost: 0
      };
    }
    usageByDate[date].requests++;
    usageByDate[date].tokens += item.total_tokens;
    usageByDate[date].cost += parseFloat(item.cost_usd);
  });

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex gap-2">
        {['all', 'week', 'month'].map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              timeRange === range
                ? 'bg-purple-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {range === 'all' && 'All Time'}
            {range === 'week' && 'Last 7 Days'}
            {range === 'month' && 'Last 30 Days'}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="text-gray-600 text-sm mb-1">Total Requests</div>
          <div className="text-3xl font-bold text-purple-600">
            {summary.totalRequests.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            ✅ {summary.successfulRequests} success · ❌ {summary.failedRequests} failed
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="text-gray-600 text-sm mb-1">Total Tokens</div>
          <div className="text-3xl font-bold text-blue-600">
            {summary.totalTokens.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            📥 {summary.totalPromptTokens.toLocaleString()} in · 📤 {summary.totalCompletionTokens.toLocaleString()} out
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="text-gray-600 text-sm mb-1">Total Cost</div>
          <div className="text-3xl font-bold text-green-600">
            ${summary.totalCost.toFixed(4)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            💰 ${(summary.totalCost / Math.max(summary.totalRequests, 1)).toFixed(6)} per request
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="text-gray-600 text-sm mb-1">Avg Response Time</div>
          <div className="text-3xl font-bold text-orange-600">
            {summary.avgResponseTime.toFixed(0)}ms
          </div>
          <div className="text-xs text-gray-500 mt-1">
            ⏱️ Average time per request
          </div>
        </div>
      </div>

      {/* Usage by Date */}
      {Object.keys(usageByDate).length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <h3 className="font-bold text-lg mb-4">Usage by Date</h3>
          <div className="space-y-2">
            {Object.entries(usageByDate).reverse().map(([date, data]) => (
              <div key={date} className="flex items-center justify-between py-2 border-b border-gray-100">
                <div className="flex-1">
                  <div className="font-medium">{date}</div>
                  <div className="text-sm text-gray-600">
                    {data.requests} requests · {data.tokens.toLocaleString()} tokens
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-green-600">${data.cost.toFixed(4)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Requests */}
      {usage.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <h3 className="font-bold text-lg mb-4">Recent Requests</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Time</th>
                  <th className="px-4 py-2 text-left">Provider</th>
                  <th className="px-4 py-2 text-left">Model</th>
                  <th className="px-4 py-2 text-right">Tokens</th>
                  <th className="px-4 py-2 text-right">Cost</th>
                  <th className="px-4 py-2 text-right">Time</th>
                  <th className="px-4 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {usage.slice(0, 10).map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2">
                      {new Date(item.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 capitalize">{item.provider}</td>
                    <td className="px-4 py-2 text-xs">{item.model}</td>
                    <td className="px-4 py-2 text-right font-mono">
                      {item.total_tokens.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-green-600">
                      ${parseFloat(item.cost_usd).toFixed(6)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {item.response_time_ms}ms
                    </td>
                    <td className="px-4 py-2 text-center">
                      {item.status === 'success' ? (
                        <span className="text-green-600">✓</span>
                      ) : (
                        <span className="text-red-600">✗</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {usage.length === 0 && (
        <div className="bg-gray-50 rounded-lg p-12 text-center">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Usage Data Yet</h3>
          <p className="text-gray-600">
            Start using your AI-powered bot to see usage statistics here.
          </p>
        </div>
      )}
    </div>
  );
}
