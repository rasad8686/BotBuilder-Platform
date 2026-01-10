import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';
import ABTestBuilder from '../../components/email/ABTestBuilder';
import ABTestResults from '../../components/email/ABTestResults';

const EmailABTesting = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [filters, setFilters] = useState({ status: '' });
  const [showBuilder, setShowBuilder] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [selectedTest, setSelectedTest] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTests();
    fetchCampaigns();
  }, [pagination.page, filters.status]);

  const fetchTests = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit
      });

      if (filters.status) {
        params.append('status', filters.status);
      }

      const response = await api.get(`/api/email/ab-tests?${params}`);
      setTests(response.data.data);
      setPagination(prev => ({ ...prev, ...response.data.pagination }));
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const response = await api.get('/api/email/campaigns?status=draft&limit=100');
      setCampaigns(response.data.data || []);
    } catch (err) {
      console.error('Error fetching campaigns:', err);
    }
  };

  const handleDeleteTest = async (testId) => {
    if (!confirm(t('email.abTest.confirmDelete', 'Are you sure you want to delete this A/B test?'))) {
      return;
    }

    try {
      await api.delete(`/api/email/ab-tests/${testId}`);
      fetchTests();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleTestCreated = () => {
    setShowBuilder(false);
    setSelectedCampaign(null);
    fetchTests();
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300', label: t('email.abTest.status.draft', 'Draft') },
      running: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: t('email.abTest.status.running', 'Running') },
      paused: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', label: t('email.abTest.status.paused', 'Paused') },
      completed: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', label: t('email.abTest.status.completed', 'Completed') },
      cancelled: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: t('email.abTest.status.cancelled', 'Cancelled') }
    };

    const config = statusConfig[status] || statusConfig.draft;
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const getTestTypeLabel = (type) => {
    const types = {
      subject: t('email.abTest.types.subject', 'Subject Line'),
      content: t('email.abTest.types.content', 'Content'),
      sender: t('email.abTest.types.sender', 'Sender'),
      send_time: t('email.abTest.types.sendTime', 'Send Time'),
      combined: t('email.abTest.types.combined', 'Combined')
    };
    return types[type] || type;
  };

  const getWinnerCriteriaLabel = (criteria) => {
    const criteriaLabels = {
      open_rate: t('email.abTest.criteria.openRate', 'Open Rate'),
      click_rate: t('email.abTest.criteria.clickRate', 'Click Rate'),
      conversion_rate: t('email.abTest.criteria.conversionRate', 'Conversion Rate'),
      revenue: t('email.abTest.criteria.revenue', 'Revenue')
    };
    return criteriaLabels[criteria] || criteria;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('email.abTest.title', 'Email A/B Testing')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {t('email.abTest.description', 'Test different email variations to optimize performance')}
          </p>
        </div>
        <button
          onClick={() => setShowBuilder(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('email.abTest.createNew', 'Create A/B Test')}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
        <div className="flex items-center gap-4">
          <select
            value={filters.status}
            onChange={(e) => setFilters({ status: e.target.value })}
            className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{t('email.abTest.allStatuses', 'All Statuses')}</option>
            <option value="draft">{t('email.abTest.status.draft', 'Draft')}</option>
            <option value="running">{t('email.abTest.status.running', 'Running')}</option>
            <option value="paused">{t('email.abTest.status.paused', 'Paused')}</option>
            <option value="completed">{t('email.abTest.status.completed', 'Completed')}</option>
          </select>

          <button
            onClick={fetchTests}
            className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            title={t('common.refresh', 'Refresh')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Tests List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
        </div>
      ) : tests.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {t('email.abTest.noTests', 'No A/B Tests Yet')}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {t('email.abTest.noTestsDescription', 'Create your first A/B test to start optimizing your email campaigns')}
          </p>
          <button
            onClick={() => setShowBuilder(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {t('email.abTest.createFirst', 'Create Your First Test')}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {tests.map(test => (
            <div
              key={test.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {test.name}
                      </h3>
                      {getStatusBadge(test.status)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span>{getTestTypeLabel(test.test_type)}</span>
                      <span className="text-gray-300 dark:text-gray-600">|</span>
                      <span>{t('email.abTest.winnerBy', 'Winner by')}: {getWinnerCriteriaLabel(test.winner_criteria)}</span>
                      <span className="text-gray-300 dark:text-gray-600">|</span>
                      <span>{t('email.abTest.sampleSize', 'Sample')}: {test.sample_size_percent}%</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedTest(test.id)}
                      className="px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50"
                    >
                      {t('email.abTest.viewResults', 'View Results')}
                    </button>
                    {test.status === 'draft' && (
                      <button
                        onClick={() => handleDeleteTest(test.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                        title={t('common.delete', 'Delete')}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Variants Preview */}
                <div className="mt-4 flex items-center gap-4">
                  {test.variants?.map(variant => (
                    <div
                      key={variant.id}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                        variant.is_winner
                          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                          : 'bg-gray-50 dark:bg-gray-700'
                      }`}
                    >
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                        variant.is_control ? 'bg-blue-500' : 'bg-purple-500'
                      }`}>
                        {variant.name}
                      </span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {variant.label}
                      </span>
                      {variant.is_winner && (
                        <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        ({variant.open_rate?.toFixed(1) || 0}% {t('email.metrics.opens', 'opens')})
                      </span>
                    </div>
                  ))}
                </div>

                {/* Timestamps */}
                <div className="mt-4 pt-4 border-t dark:border-gray-700 flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
                  <span>
                    {t('common.created', 'Created')}: {new Date(test.created_at).toLocaleDateString()}
                  </span>
                  {test.started_at && (
                    <span>
                      {t('email.abTest.started', 'Started')}: {new Date(test.started_at).toLocaleDateString()}
                    </span>
                  )}
                  {test.completed_at && (
                    <span>
                      {t('email.abTest.completed', 'Completed')}: {new Date(test.completed_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600"
              >
                {t('common.previous', 'Previous')}
              </button>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {t('common.pageOf', 'Page {{current}} of {{total}}', { current: pagination.page, total: pagination.pages })}
              </span>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page === pagination.pages}
                className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600"
              >
                {t('common.next', 'Next')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create Test Modal */}
      {showBuilder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          {selectedCampaign ? (
            <ABTestBuilder
              campaignId={selectedCampaign.id}
              campaign={selectedCampaign}
              onTestCreated={handleTestCreated}
              onClose={() => {
                setShowBuilder(false);
                setSelectedCampaign(null);
              }}
            />
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg max-w-lg w-full p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                {t('email.abTest.selectCampaign', 'Select Campaign')}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {t('email.abTest.selectCampaignDescription', 'Choose a campaign to create an A/B test for')}
              </p>

              {campaigns.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    {t('email.abTest.noCampaigns', 'No draft campaigns available')}
                  </p>
                  <button
                    onClick={() => setShowBuilder(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    {t('common.close', 'Close')}
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {campaigns.map(campaign => (
                    <button
                      key={campaign.id}
                      onClick={() => setSelectedCampaign(campaign)}
                      className="w-full text-left p-3 rounded-lg border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="font-medium text-gray-900 dark:text-white">
                        {campaign.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {campaign.subject}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setShowBuilder(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results Modal */}
      {selectedTest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <ABTestResults
            testId={selectedTest}
            onClose={() => setSelectedTest(null)}
            onRefresh={fetchTests}
          />
        </div>
      )}
    </div>
  );
};

export default EmailABTesting;
