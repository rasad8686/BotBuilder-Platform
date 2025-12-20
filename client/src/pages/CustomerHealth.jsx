import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Search,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Phone,
  Mail,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Activity,
  Heart,
  Shield
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts';
import api from '../utils/api';

/**
 * CustomerHealth Page
 * Customer health scores and churn risk management
 */
const CustomerHealth = () => {
  const { t } = useTranslation();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [expandedCustomer, setExpandedCustomer] = useState(null);
  const [contactingCustomer, setContactingCustomer] = useState(null);
  const [healthDistribution, setHealthDistribution] = useState([]);

  useEffect(() => {
    fetchCustomers();
  }, [riskFilter]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { limit: 100 };
      if (riskFilter !== 'all') {
        params.risk_level = riskFilter;
      }
      const [customersRes, distributionRes] = await Promise.all([
        api.get('/api/recovery/customers/health', { params }),
        api.get('/api/recovery/analytics/dashboard')
      ]);
      setCustomers(customersRes.data.customers || []);

      // Build health distribution for chart
      const dist = distributionRes.data.health_distribution || {};
      setHealthDistribution([
        { name: t('recovery.healthyAB'), value: (dist.A || 0) + (dist.B || 0), color: '#10b981' },
        { name: t('recovery.atRiskC'), value: dist.C || 0, color: '#f59e0b' },
        { name: t('recovery.criticalDF'), value: (dist.D || 0) + (dist.F || 0), color: '#ef4444' }
      ]);
    } catch (err) {
      setError(err.response?.data?.message || t('recovery.failedToLoadHealth'));
    } finally {
      setLoading(false);
    }
  };

  const handleProactiveContact = async (customer) => {
    try {
      setContactingCustomer(customer.customer_id);
      // This would trigger proactive outreach
      await api.post(`/api/recovery/customers/${customer.customer_id}/health`, {
        action: 'proactive_contact'
      });
      alert(t('recovery.contactInitiated'));
    } catch (err) {
      alert(err.response?.data?.message || t('recovery.contactError'));
    } finally {
      setContactingCustomer(null);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-blue-600 bg-blue-100';
    if (score >= 40) return 'text-yellow-600 bg-yellow-100';
    if (score >= 20) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const getGradeColor = (grade) => {
    switch (grade) {
      case 'A': return 'bg-green-500';
      case 'B': return 'bg-green-400';
      case 'C': return 'bg-yellow-500';
      case 'D': return 'bg-orange-500';
      case 'F': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getRiskBadge = (level) => {
    switch (level) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">
            <AlertTriangle className="w-3 h-3" /> {t('recovery.critical')}
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-700">
            <TrendingDown className="w-3 h-3" /> {t('recovery.high')}
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700">
            <Activity className="w-3 h-3" /> {t('recovery.medium')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
            <TrendingUp className="w-3 h-3" /> {t('recovery.low')}
          </span>
        );
    }
  };

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch =
      (customer.customer_email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (customer.customer_name?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-gray-200">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('recovery.failedToLoadData')}</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchCustomers}
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
        <h1 className="text-2xl font-bold text-gray-900">{t('recovery.customerHealthTitle')}</h1>
        <p className="text-gray-600 mt-1">{t('recovery.customerHealthSubtitle')}</p>
      </div>

      {/* Health Distribution Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('recovery.healthScoreDistribution')}</h3>
          {loading ? (
            <div className="h-64 animate-pulse bg-gray-100 rounded"></div>
          ) : (
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={healthDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {healthDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [value, 'Customers']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">{t('recovery.criticalRisk')}</p>
                <p className="text-xl font-bold text-gray-900">
                  {customers.filter(c => c.churn_risk_level === 'critical').length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">{t('recovery.highRisk')}</p>
                <p className="text-xl font-bold text-gray-900">
                  {customers.filter(c => c.churn_risk_level === 'high').length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Heart className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">{t('recovery.healthy')}</p>
                <p className="text-xl font-bold text-gray-900">
                  {customers.filter(c => c.churn_risk_level === 'low').length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder={t('recovery.searchByCustomer')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="all">{t('recovery.allRiskLevels')}</option>
          <option value="critical">{t('recovery.critical')}</option>
          <option value="high">{t('recovery.high')}</option>
          <option value="medium">{t('recovery.medium')}</option>
          <option value="low">{t('recovery.low')}</option>
        </select>
      </div>

      {/* Customers List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="h-12 w-12 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                </div>
                <div className="h-10 w-16 bg-gray-200 rounded-full"></div>
              </div>
            ))}
          </div>
        ) : filteredCustomers.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {filteredCustomers.map((customer) => (
              <div key={customer.customer_id} className="hover:bg-gray-50 transition-colors">
                <div className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Users className="w-6 h-6 text-indigo-600" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {customer.customer_email || t('recovery.unknownCustomer')}
                      </p>
                      {getRiskBadge(customer.churn_risk_level)}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {t('recovery.churnProbability')}: {((customer.churn_probability || 0) * 100).toFixed(0)}%
                    </p>
                  </div>

                  {/* Health Score */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getScoreColor(customer.health_score)}`}>
                      <span className="text-lg font-bold">{customer.health_score || 0}</span>
                    </div>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${getGradeColor(customer.health_grade)}`}>
                      {customer.health_grade || '?'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(customer.churn_risk_level === 'critical' || customer.churn_risk_level === 'high') && (
                      <button
                        onClick={() => handleProactiveContact(customer)}
                        disabled={contactingCustomer === customer.customer_id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {contactingCustomer === customer.customer_id ? (
                          <>
                            <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                            {t('recovery.contacting')}
                          </>
                        ) : (
                          <>
                            <Phone className="w-4 h-4" />
                            {t('recovery.contact')}
                          </>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedCustomer(expandedCustomer === customer.customer_id ? null : customer.customer_id)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      {expandedCustomer === customer.customer_id ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedCustomer === customer.customer_id && (
                  <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-100">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Health Components */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-3">{t('recovery.healthComponents')}</h4>
                        <div className="space-y-2">
                          {customer.component_scores && Object.entries(customer.component_scores).map(([key, value]) => (
                            <div key={key} className="flex items-center justify-between p-2 bg-white rounded-lg">
                              <span className="text-sm text-gray-600 capitalize">{key.replace('_', ' ')}</span>
                              <div className="flex items-center gap-2">
                                <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${value >= 70 ? 'bg-green-500' : value >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                    style={{ width: `${value}%` }}
                                  ></div>
                                </div>
                                <span className="text-sm font-medium text-gray-900 w-8">{value}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Risk Signals */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-3">{t('recovery.riskSignals')}</h4>
                        {customer.risk_signals && customer.risk_signals.length > 0 ? (
                          <div className="space-y-2">
                            {customer.risk_signals.map((signal, index) => (
                              <div key={index} className="flex items-center gap-2 p-2 bg-white rounded-lg">
                                <AlertTriangle className="w-4 h-4 text-orange-500" />
                                <span className="text-sm text-gray-700 capitalize">{signal.replace('_', ' ')}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 flex items-center gap-2">
                            <Shield className="w-4 h-4 text-green-500" />
                            {t('recovery.noRiskSignals')}
                          </p>
                        )}
                      </div>

                      {/* Retention Strategy */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-3">{t('recovery.recommendedActions')}</h4>
                        {customer.retention_strategy ? (
                          <div className="space-y-2">
                            {customer.retention_strategy.actions?.slice(0, 3).map((action, index) => (
                              <div key={index} className="p-2 bg-white rounded-lg">
                                <p className="text-sm text-gray-700">{action}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">{t('recovery.noActionsRecommended')}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">{t('recovery.noCustomersFound')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerHealth;
