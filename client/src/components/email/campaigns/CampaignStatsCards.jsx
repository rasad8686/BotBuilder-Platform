import React from 'react';
import { Send, CheckCircle, Eye, MousePointer, TrendingUp, TrendingDown } from 'lucide-react';

const CampaignStatsCards = ({ stats, averages = {} }) => {
  const cards = [
    {
      icon: Send,
      label: 'Sent',
      value: stats.sent || 0,
      color: 'blue',
      showBar: false
    },
    {
      icon: CheckCircle,
      label: 'Delivered',
      value: stats.delivered || 0,
      rate: stats.sent ? ((stats.delivered / stats.sent) * 100).toFixed(1) : 0,
      color: 'green',
      showBar: true,
      barColor: 'bg-green-500'
    },
    {
      icon: Eye,
      label: 'Open Rate',
      value: stats.opens || 0,
      rate: stats.delivered ? ((stats.opens / stats.delivered) * 100).toFixed(1) : 0,
      average: averages.openRate,
      color: 'purple',
      showBar: true,
      barColor: 'bg-purple-500'
    },
    {
      icon: MousePointer,
      label: 'Click Rate',
      value: stats.clicks || 0,
      rate: stats.delivered ? ((stats.clicks / stats.delivered) * 100).toFixed(1) : 0,
      average: averages.clickRate,
      color: 'indigo',
      showBar: true,
      barColor: 'bg-indigo-500'
    }
  ];

  const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const getColorClasses = (color) => ({
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    indigo: 'bg-indigo-50 text-indigo-600'
  }[color]);

  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        const comparison = card.average ? parseFloat(card.rate) - card.average : null;

        return (
          <div key={index} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${getColorClasses(card.color)}`}>
                <Icon className="w-5 h-5" />
              </div>
              {comparison !== null && (
                <div className={`flex items-center gap-1 text-xs ${
                  comparison >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {comparison >= 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {Math.abs(comparison).toFixed(1)}% vs avg
                </div>
              )}
            </div>

            <p className="text-2xl font-bold text-gray-900 mb-1">
              {card.rate !== undefined ? `${card.rate}%` : formatNumber(card.value)}
            </p>
            <p className="text-sm text-gray-500">{card.label}</p>

            {card.showBar && (
              <div className="mt-3">
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${card.barColor} rounded-full transition-all duration-500`}
                    style={{ width: `${Math.min(parseFloat(card.rate) || 0, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1 text-xs text-gray-400">
                  <span>{formatNumber(card.value)} total</span>
                  {card.average && <span>Avg: {card.average}%</span>}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default CampaignStatsCards;
