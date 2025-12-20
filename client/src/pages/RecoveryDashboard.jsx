import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Users,
  AlertCircle,
  Play,
  Pause,
  ArrowRight
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import StatCard from '../components/StatCard';
import api from '../utils/api';

/**
 * RecoveryDashboard Page
 * AI Revenue Recovery Engine dashboard with statistics and analytics
 */
const RecoveryDashboard = () => {
  const { t, i18n } = useTranslation();
  const [stats, setStats] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [recentCarts, setRecentCarts] = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [dashboardRes, campaignsRes, cartsRes, revenueRes] = await Promise.all([
        api.get('/api/recovery/analytics/dashboard'),
        api.get('/api/recovery/campaigns', { params: { limit: 5, status: 'active' } }),
        api.get('/api/recovery/carts', { params: { limit: 5 } }),
        api.get('/api/recovery/analytics/revenue')
      ]);

      setStats(dashboardRes.data);
      setCampaigns(campaignsRes.data.campaigns || []);
      setRecentCarts(cartsRes.data.carts || []);
      setRevenueData(revenueRes.data.daily_breakdown || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value || 0);
  };

  const formatPercent = (value) => {
    return `${(value || 0).toFixed(1)}%`;
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-gray-200">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('recovery.failedToLoad')}</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            {t('recovery.tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('recovery.dashboardTitle')}</h1>
        <p className="text-gray-600 mt-1">{t('recovery.dashboardSubtitle')}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title={t('recovery.revenueRecovered')}
          value={formatCurrency(stats?.total_recovered)}
          icon={DollarSign}
          color="green"
          trend={stats?.recovery_trend}
          trendLabel={t('recovery.vsLastMonth')}
          loading={loading}
        />
        <StatCard
          title={t('recovery.recoveryRate')}
          value={formatPercent(stats?.recovery_rate)}
          icon={TrendingUp}
          color="blue"
          trend={stats?.rate_trend}
          trendLabel={t('recovery.vsLastMonth')}
          loading={loading}
        />
        <StatCard
          title={t('recovery.abandonedCarts')}
          value={stats?.abandoned_carts || 0}
          icon={ShoppingCart}
          color="orange"
          loading={loading}
        />
        <StatCard
          title={t('recovery.atRiskCustomers')}
          value={stats?.at_risk_customers || 0}
          icon={Users}
          color="red"
          loading={loading}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Trend Chart */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('recovery.revenueRecoveryTrend')}</h3>
          {loading ? (
            <div className="h-64 animate-pulse bg-gray-100 rounded"></div>
          ) : revenueData.length > 0 ? (
            <ResponsiveContainer width="100%" height={264}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' })}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `$${value / 1000}k`}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(value), t('recovery.recovered')]}
                  labelFormatter={(label) => new Date(label).toLocaleDateString()}
                />
                <Line
                  type="monotone"
                  dataKey="recovered"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: '#10b981', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              {t('recovery.noRevenueData')}
            </div>
          )}
        </div>

        {/* Active Campaigns */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{t('recovery.activeCampaigns')}</h3>
            <a href="/recovery/campaigns" className="text-indigo-600 hover:text-indigo-700 text-sm flex items-center gap-1">
              {t('recovery.viewAll')} <ArrowRight className="w-4 h-4" />
            </a>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="h-4 bg-gray-200 rounded w-32"></div>
                  <div className="h-6 bg-gray-200 rounded w-16"></div>
                </div>
              ))}
            </div>
          ) : campaigns.length > 0 ? (
            <div className="space-y-3">
              {campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{campaign.name}</p>
                    <p className="text-xs text-gray-500">{campaign.campaign_type}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {campaign.status === 'active' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                        <Play className="w-3 h-3" /> {t('recovery.active')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                        <Pause className="w-3 h-3" /> {t('recovery.paused')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">{t('recovery.noActiveCampaigns')}</p>
          )}
        </div>
      </div>

      {/* Recent Recovered Carts */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{t('recovery.recentlyRecoveredCarts')}</h3>
          <a href="/recovery/carts" className="text-indigo-600 hover:text-indigo-700 text-sm flex items-center gap-1">
            {t('recovery.viewAll')} <ArrowRight className="w-4 h-4" />
          </a>
        </div>
        {loading ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="pb-3">{t('recovery.customer')}</th>
                  <th className="pb-3">{t('recovery.cartValue')}</th>
                  <th className="pb-3">{t('recovery.status')}</th>
                  <th className="pb-3">{t('recovery.recoveredAt')}</th>
                </tr>
              </thead>
              <tbody>
                {[...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse border-t border-gray-100">
                    <td className="py-3"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                    <td className="py-3"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
                    <td className="py-3"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                    <td className="py-3"><div className="h-4 bg-gray-200 rounded w-28"></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : recentCarts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="pb-3">{t('recovery.customer')}</th>
                  <th className="pb-3">{t('recovery.cartValue')}</th>
                  <th className="pb-3">{t('recovery.status')}</th>
                  <th className="pb-3">{t('recovery.date')}</th>
                </tr>
              </thead>
              <tbody>
                {recentCarts.map((cart) => (
                  <tr key={cart.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="py-3">
                      <p className="text-sm font-medium text-gray-900">{cart.customer_email || t('recovery.unknown')}</p>
                    </td>
                    <td className="py-3">
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(cart.cart_value)}</p>
                    </td>
                    <td className="py-3">
                      <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                        cart.status === 'recovered' ? 'bg-green-100 text-green-700' :
                        cart.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                        cart.status === 'abandoned' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {cart.status}
                      </span>
                    </td>
                    <td className="py-3">
                      <p className="text-sm text-gray-500">
                        {new Date(cart.created_at).toLocaleDateString()}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">{t('recovery.noRecoveredCarts')}</p>
        )}
      </div>
    </div>
  );
};

export default RecoveryDashboard;
