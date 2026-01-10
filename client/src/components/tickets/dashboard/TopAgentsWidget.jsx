import { useTranslation } from 'react-i18next';
import { Trophy, Clock, Star } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '../../ui/Card';
import { Badge } from '../../ui/Badge';

export default function TopAgentsWidget({ agents }) {
  const { t } = useTranslation();

  // Mock data if not provided
  const agentsData = agents || [
    { id: 1, name: 'John Doe', resolved: 45, avgResponseTime: 1.2, satisfaction: 98 },
    { id: 2, name: 'Jane Smith', resolved: 38, avgResponseTime: 1.5, satisfaction: 96 },
    { id: 3, name: 'Bob Johnson', resolved: 32, avgResponseTime: 2.1, satisfaction: 94 },
    { id: 4, name: 'Alice Brown', resolved: 28, avgResponseTime: 1.8, satisfaction: 95 },
    { id: 5, name: 'Charlie Wilson', resolved: 25, avgResponseTime: 2.4, satisfaction: 92 }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          {t('tickets.topAgents', 'Top Agents')}
        </CardTitle>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-slate-700">
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400">
                {t('tickets.agent', 'Agent')}
              </th>
              <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400">
                {t('tickets.resolved', 'Resolved')}
              </th>
              <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400">
                {t('tickets.avgResponse', 'Avg Response')}
              </th>
              <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400">
                {t('tickets.satisfaction', 'CSAT')}
              </th>
            </tr>
          </thead>
          <tbody>
            {agentsData.map((agent, index) => (
              <tr
                key={agent.id}
                className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50"
              >
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    {index < 3 && (
                      <span className={`
                        w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                        ${index === 0 ? 'bg-yellow-100 text-yellow-600' :
                          index === 1 ? 'bg-gray-100 text-gray-600' :
                          'bg-orange-100 text-orange-600'}
                      `}>
                        {index + 1}
                      </span>
                    )}
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-sm font-medium text-purple-600 dark:text-purple-400">
                        {agent.name.charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {agent.name}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 text-right">
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {agent.resolved}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center justify-end gap-1">
                    <Clock className="w-3 h-3" />
                    {agent.avgResponseTime}h
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <Badge
                    variant={agent.satisfaction >= 95 ? 'success' : agent.satisfaction >= 90 ? 'warning' : 'secondary'}
                    size="sm"
                  >
                    <Star className="w-3 h-3 mr-1" />
                    {agent.satisfaction}%
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
