import React from 'react';
import { useNavigate } from 'react-router-dom';

const TopCampaignsWidget = ({ campaigns, isLoading }) => {
  const navigate = useNavigate();

  // Handle API response format { success: true, campaigns: [...] } or direct array
  const campaignData = Array.isArray(campaigns) ? campaigns : (campaigns?.campaigns || [
    { id: 'demo-campaign-1', name: 'Summer Sale Promo', openRate: 32.5, clickRate: 12.3, sent: 12450 },
    { id: 'demo-campaign-2', name: 'Monthly Newsletter', openRate: 28.2, clickRate: 8.5, sent: 8230 },
    { id: 'demo-campaign-3', name: 'Welcome Series #1', openRate: 45.1, clickRate: 15.2, sent: 1892 },
    { id: 'demo-campaign-4', name: 'Product Launch', openRate: 35.8, clickRate: 11.7, sent: 5430 },
    { id: 'demo-campaign-5', name: 'Re-engagement', openRate: 22.4, clickRate: 6.8, sent: 3210 }
  ]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="h-4 bg-gray-200 rounded w-32 mb-4 animate-pulse"></div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-gray-100 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-40"></div>
            <div className="h-4 bg-gray-200 rounded w-12"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-gray-900">Top Campaigns</h3>
        <button
          onClick={() => navigate('/email/campaigns')}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          View All
        </button>
      </div>

      <div className="space-y-1">
        {campaignData.map((campaign, index) => (
          <div
            key={campaign.id}
            className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer rounded px-2 -mx-2"
            onClick={() => navigate(`/email/campaigns/${campaign.id}/report`)}
          >
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">
                {index + 1}
              </span>
              <div>
                <p className="font-medium text-gray-900 text-sm">{campaign.name}</p>
                <p className="text-xs text-gray-500">{campaign.sent.toLocaleString()} sent</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-medium text-gray-900">{campaign.openRate}%</p>
              <p className="text-xs text-gray-500">open rate</p>
            </div>
          </div>
        ))}
      </div>

      {campaignData.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p>No campaigns in this period</p>
        </div>
      )}
    </div>
  );
};

export default TopCampaignsWidget;
