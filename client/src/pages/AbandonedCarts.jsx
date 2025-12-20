import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ShoppingCart,
  Search,
  Filter,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Mail,
  MessageSquare,
  Calendar
} from 'lucide-react';
import api from '../utils/api';

/**
 * AbandonedCarts Page
 * Manage abandoned cart recovery
 */
const AbandonedCarts = () => {
  const { t } = useTranslation();
  const [carts, setCarts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [expandedCart, setExpandedCart] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [recovering, setRecovering] = useState(null);

  useEffect(() => {
    fetchCarts();
  }, [statusFilter, dateRange]);

  const fetchCarts = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { limit: 100 };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      if (dateRange.start) {
        params.start_date = dateRange.start;
      }
      if (dateRange.end) {
        params.end_date = dateRange.end;
      }
      const response = await api.get('/api/recovery/carts', { params });
      setCarts(response.data.carts || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load abandoned carts');
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverCart = async (cart) => {
    try {
      setRecovering(cart.id);
      await api.post(`/api/recovery/carts/${cart.id}/recover`, {
        customer_id: cart.customer_id
      });
      alert(t('recovery.recoveryStarted'));
      fetchCarts();
    } catch (err) {
      alert(err.response?.data?.message || t('recovery.recoveryError'));
    } finally {
      setRecovering(null);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value || 0);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'recovered':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-blue-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <ShoppingCart className="w-4 h-4 text-orange-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'recovered':
        return 'bg-green-100 text-green-700';
      case 'in_progress':
        return 'bg-blue-100 text-blue-700';
      case 'failed':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-orange-100 text-orange-700';
    }
  };

  const filteredCarts = carts.filter(cart => {
    const matchesSearch =
      (cart.customer_email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (cart.customer_name?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-gray-200">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('recovery.failedToLoadCarts')}</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchCarts}
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
        <h1 className="text-2xl font-bold text-gray-900">{t('recovery.abandonedCartsTitle')}</h1>
        <p className="text-gray-600 mt-1">{t('recovery.abandonedCartsSubtitle')}</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
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
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="all">{t('recovery.allStatus')}</option>
            <option value="abandoned">{t('recovery.abandoned')}</option>
            <option value="in_progress">{t('recovery.inProgress')}</option>
            <option value="recovered">{t('recovery.recovered')}</option>
            <option value="failed">{t('recovery.failed')}</option>
          </select>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Filter className="w-5 h-5" />
            {t('recovery.filters')}
            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Extended Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                {t('recovery.startDate')}
              </label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                {t('recovery.endDate')}
              </label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Carts List */}
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
                <div className="h-8 bg-gray-200 rounded w-24"></div>
              </div>
            ))}
          </div>
        ) : filteredCarts.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {filteredCarts.map((cart) => (
              <div key={cart.id} className="hover:bg-gray-50 transition-colors">
                <div className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <ShoppingCart className="w-6 h-6 text-orange-600" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {cart.customer_email || t('recovery.unknownCustomer')}
                      </p>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${getStatusColor(cart.status)}`}>
                        {getStatusIcon(cart.status)}
                        {cart.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                      <span>{cart.items_count || 0} {t('recovery.items')}</span>
                      <span>{t('recovery.abandonedOn')} {new Date(cart.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-semibold text-gray-900">{formatCurrency(cart.cart_value)}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {cart.status === 'abandoned' && (
                      <button
                        onClick={() => handleRecoverCart(cart)}
                        disabled={recovering === cart.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {recovering === cart.id ? (
                          <>
                            <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                            {t('recovery.recovering')}
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            {t('recovery.recover')}
                          </>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedCart(expandedCart === cart.id ? null : cart.id)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      {expandedCart === cart.id ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedCart === cart.id && (
                  <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Cart Items */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-3">{t('recovery.cartItems')}</h4>
                        {cart.items && cart.items.length > 0 ? (
                          <div className="space-y-2">
                            {cart.items.map((item, index) => (
                              <div key={index} className="flex items-center justify-between p-2 bg-white rounded-lg">
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{item.name}</p>
                                  <p className="text-xs text-gray-500">{t('recovery.qty')}: {item.quantity}</p>
                                </div>
                                <p className="text-sm font-semibold text-gray-900">{formatCurrency(item.price)}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">{t('recovery.noItemDetails')}</p>
                        )}
                      </div>

                      {/* Message History */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-3">{t('recovery.recoveryMessages')}</h4>
                        {cart.messages && cart.messages.length > 0 ? (
                          <div className="space-y-2">
                            {cart.messages.map((msg, index) => (
                              <div key={index} className="flex items-start gap-2 p-2 bg-white rounded-lg">
                                {msg.channel === 'email' ? (
                                  <Mail className="w-4 h-4 text-blue-500 mt-0.5" />
                                ) : (
                                  <MessageSquare className="w-4 h-4 text-green-500 mt-0.5" />
                                )}
                                <div>
                                  <p className="text-xs font-medium text-gray-900">{msg.channel}</p>
                                  <p className="text-xs text-gray-500">
                                    {msg.status} - {new Date(msg.sent_at).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">{t('recovery.noMessagesSent')}</p>
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
            <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">{t('recovery.noAbandonedCarts')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AbandonedCarts;
