import React, { useState, useMemo } from 'react';
import { useEmailOverviewQuery, useEmailVolumeQuery, useTopCampaignsQuery, useEngagementByHourQuery, useContactGrowthQuery, useEngagementSegmentsQuery } from '../../hooks/email/useEmailAnalytics';
import EmailSummaryCards from '../../components/email/analytics/EmailSummaryCards';
import EmailVolumeChart from '../../components/email/analytics/EmailVolumeChart';
import TopCampaignsWidget from '../../components/email/analytics/TopCampaignsWidget';
import EngagementByDayChart from '../../components/email/analytics/EngagementByDayChart';
import ContactGrowthChart from '../../components/email/analytics/ContactGrowthChart';
import EngagementBreakdownChart from '../../components/email/analytics/EngagementBreakdownChart';
import CampaignPerformanceTable from '../../components/email/analytics/CampaignPerformanceTable';
import EmailHealthScore from '../../components/email/analytics/EmailHealthScore';

const EmailAnalyticsDashboardPage = () => {
  const [dateRange, setDateRange] = useState('30d');
  const [activeTab, setActiveTab] = useState('overview');

  const dateRangeOptions = [
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' },
    { value: 'custom', label: 'Custom Range' }
  ];

  const computedDateRange = useMemo(() => {
    const end = new Date();
    const start = new Date();
    switch (dateRange) {
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
      case '90d':
        start.setDate(start.getDate() - 90);
        break;
      default:
        start.setDate(start.getDate() - 30);
    }
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }, [dateRange]);

  const { data: overview, isLoading: overviewLoading } = useEmailOverviewQuery(computedDateRange);
  const { data: volumeData, isLoading: volumeLoading } = useEmailVolumeQuery(computedDateRange, 'day');
  const { data: topCampaigns, isLoading: campaignsLoading } = useTopCampaignsQuery(computedDateRange);
  const { data: engagementByHour } = useEngagementByHourQuery(computedDateRange);
  const { data: contactGrowth } = useContactGrowthQuery(computedDateRange);
  const { data: engagementSegments } = useEngagementSegmentsQuery();

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'campaigns', label: 'Campaigns' },
    { id: 'contacts', label: 'Contacts' },
    { id: 'engagement', label: 'Engagement' }
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Analytics</h1>
          <p className="text-gray-600">Track your email marketing performance</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {dateRangeOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export Report
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mb-6">
        <EmailSummaryCards data={overview} isLoading={overviewLoading} />
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200 mb-6">
        <div className="border-b border-gray-200">
          <div className="flex gap-4 px-4">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Email Volume Chart */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium mb-4">Email Volume Trend</h3>
                <EmailVolumeChart data={volumeData} isLoading={volumeLoading} />
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TopCampaignsWidget campaigns={topCampaigns} isLoading={campaignsLoading} />
                <EngagementByDayChart data={engagementByHour} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ContactGrowthChart data={contactGrowth} />
                <EngagementBreakdownChart data={engagementSegments} />
              </div>

              {/* Email Health Score */}
              <EmailHealthScore overview={overview} />
            </div>
          )}

          {activeTab === 'campaigns' && (
            <div>
              <h3 className="text-lg font-medium mb-4">Campaign Performance</h3>
              <CampaignPerformanceTable dateRange={computedDateRange} />
            </div>
          )}

          {activeTab === 'contacts' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-medium mb-4">Contact Growth</h3>
                  <ContactGrowthChart data={contactGrowth} />
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-medium mb-4">Engagement Segments</h3>
                  <EngagementBreakdownChart data={engagementSegments} />
                </div>
              </div>

              {/* Contact Stats */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600">Total Contacts</p>
                  <p className="text-2xl font-bold">{overview?.totalContacts?.toLocaleString() || 0}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600">New This Period</p>
                  <p className="text-2xl font-bold text-green-600">+{overview?.newContacts?.toLocaleString() || 0}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600">Unsubscribed</p>
                  <p className="text-2xl font-bold text-red-600">{overview?.unsubscribed?.toLocaleString() || 0}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600">Net Growth</p>
                  <p className={`text-2xl font-bold ${(overview?.netGrowth || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(overview?.netGrowth || 0) >= 0 ? '+' : ''}{overview?.netGrowth?.toLocaleString() || 0}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'engagement' && (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium mb-4">Best Time to Send</h3>
                <EngagementByDayChart data={engagementByHour} showHeatmap />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <h4 className="font-medium mb-3">Top Performing Days</h4>
                  <div className="space-y-2">
                    {['Tuesday', 'Wednesday', 'Thursday'].map((day, i) => (
                      <div key={day} className="flex items-center justify-between">
                        <span className="text-gray-600">{day}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${90 - i * 10}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-500">{28 - i * 2}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <h4 className="font-medium mb-3">Top Performing Hours</h4>
                  <div className="space-y-2">
                    {['10:00 AM', '2:00 PM', '11:00 AM'].map((time, i) => (
                      <div key={time} className="flex items-center justify-between">
                        <span className="text-gray-600">{time}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full"
                              style={{ width: `${85 - i * 8}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-500">{32 - i * 3}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Device & Client Stats */}
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <h4 className="font-medium mb-3">Opens by Device</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span>Mobile</span>
                      </div>
                      <span className="font-medium">54%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span>Desktop</span>
                      </div>
                      <span className="font-medium">38%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span>Tablet</span>
                      </div>
                      <span className="font-medium">8%</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <h4 className="font-medium mb-3">Top Email Clients</h4>
                  <div className="space-y-3">
                    {[
                      { name: 'Gmail', percentage: 42 },
                      { name: 'Apple Mail', percentage: 28 },
                      { name: 'Outlook', percentage: 18 },
                      { name: 'Other', percentage: 12 }
                    ].map(client => (
                      <div key={client.name} className="flex items-center justify-between">
                        <span>{client.name}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${client.percentage}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-500 w-8">{client.percentage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailAnalyticsDashboardPage;
