import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const CampaignPerformanceTable = ({ dateRange }) => {
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState('sent_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const perPage = 10;

  // Mock data
  const campaigns = [
    { id: 1, name: 'Summer Sale Promo', sent_at: '2024-01-15', sent: 12450, delivered: 12200, opens: 3904, clicks: 1464, unsubscribes: 24, revenue: 4520 },
    { id: 2, name: 'Monthly Newsletter', sent_at: '2024-01-12', sent: 8230, delivered: 8100, opens: 2268, clicks: 648, unsubscribes: 12, revenue: 1230 },
    { id: 3, name: 'Welcome Series #1', sent_at: '2024-01-10', sent: 1892, delivered: 1870, opens: 843, clicks: 280, unsubscribes: 5, revenue: 890 },
    { id: 4, name: 'Product Launch', sent_at: '2024-01-08', sent: 5430, delivered: 5340, opens: 1922, clicks: 625, unsubscribes: 18, revenue: 3450 },
    { id: 5, name: 'Re-engagement', sent_at: '2024-01-05', sent: 3210, delivered: 3150, opens: 693, clicks: 214, unsubscribes: 45, revenue: 560 },
    { id: 6, name: 'Black Friday Teaser', sent_at: '2024-01-03', sent: 15000, delivered: 14700, opens: 5880, clicks: 2205, unsubscribes: 32, revenue: 8920 },
    { id: 7, name: 'Holiday Special', sent_at: '2024-01-01', sent: 9800, delivered: 9600, opens: 3360, clicks: 960, unsubscribes: 28, revenue: 5670 }
  ];

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const sortedCampaigns = [...campaigns].sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    const order = sortOrder === 'asc' ? 1 : -1;

    if (typeof aVal === 'string') {
      return aVal.localeCompare(bVal) * order;
    }
    return (aVal - bVal) * order;
  });

  const paginatedCampaigns = sortedCampaigns.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.ceil(campaigns.length / perPage);

  const SortIcon = ({ column }) => (
    <svg className={`w-4 h-4 ${sortBy === column ? 'text-blue-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {sortBy === column && sortOrder === 'asc' ? (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      )}
    </svg>
  );

  const formatRate = (value, total) => {
    if (total === 0) return '0%';
    return `${((value / total) * 100).toFixed(1)}%`;
  };

  return (
    <div className="space-y-4">
      {/* Export Button */}
      <div className="flex justify-end">
        <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
              <th className="pb-3 pr-4">
                <button onClick={() => handleSort('name')} className="flex items-center gap-1 font-medium hover:text-gray-700">
                  Campaign <SortIcon column="name" />
                </button>
              </th>
              <th className="pb-3 px-4">
                <button onClick={() => handleSort('sent_at')} className="flex items-center gap-1 font-medium hover:text-gray-700">
                  Sent <SortIcon column="sent_at" />
                </button>
              </th>
              <th className="pb-3 px-4">
                <button onClick={() => handleSort('sent')} className="flex items-center gap-1 font-medium hover:text-gray-700">
                  Recipients <SortIcon column="sent" />
                </button>
              </th>
              <th className="pb-3 px-4">
                <button onClick={() => handleSort('opens')} className="flex items-center gap-1 font-medium hover:text-gray-700">
                  Opens <SortIcon column="opens" />
                </button>
              </th>
              <th className="pb-3 px-4">
                <button onClick={() => handleSort('clicks')} className="flex items-center gap-1 font-medium hover:text-gray-700">
                  Clicks <SortIcon column="clicks" />
                </button>
              </th>
              <th className="pb-3 px-4">Unsubs</th>
              <th className="pb-3 px-4">
                <button onClick={() => handleSort('revenue')} className="flex items-center gap-1 font-medium hover:text-gray-700">
                  Revenue <SortIcon column="revenue" />
                </button>
              </th>
              <th className="pb-3 pl-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedCampaigns.map(campaign => (
              <tr key={campaign.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-4 pr-4">
                  <p className="font-medium text-gray-900">{campaign.name}</p>
                </td>
                <td className="py-4 px-4 text-sm text-gray-600">
                  {new Date(campaign.sent_at).toLocaleDateString()}
                </td>
                <td className="py-4 px-4">
                  <p className="text-sm text-gray-900">{campaign.sent.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">{formatRate(campaign.delivered, campaign.sent)} delivered</p>
                </td>
                <td className="py-4 px-4">
                  <p className="text-sm text-gray-900">{campaign.opens.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">{formatRate(campaign.opens, campaign.delivered)}</p>
                </td>
                <td className="py-4 px-4">
                  <p className="text-sm text-gray-900">{campaign.clicks.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">{formatRate(campaign.clicks, campaign.delivered)}</p>
                </td>
                <td className="py-4 px-4">
                  <p className="text-sm text-gray-900">{campaign.unsubscribes}</p>
                  <p className="text-xs text-gray-500">{formatRate(campaign.unsubscribes, campaign.delivered)}</p>
                </td>
                <td className="py-4 px-4">
                  <p className="text-sm font-medium text-green-600">${campaign.revenue.toLocaleString()}</p>
                </td>
                <td className="py-4 pl-4">
                  <button
                    onClick={() => navigate(`/email/campaigns/${campaign.id}/report`)}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    View Report
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Showing {(page - 1) * perPage + 1} to {Math.min(page * perPage, campaigns.length)} of {campaigns.length} campaigns
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          {[...Array(totalPages)].map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={`px-3 py-1 rounded text-sm ${
                page === i + 1
                  ? 'bg-blue-600 text-white'
                  : 'border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {i + 1}
            </button>
          ))}
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default CampaignPerformanceTable;
