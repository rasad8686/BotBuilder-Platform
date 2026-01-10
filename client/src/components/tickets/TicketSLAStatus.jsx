import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '../ui/Card';

export default function TicketSLAStatus({
  firstResponseTarget,
  firstResponseAt,
  resolutionTarget,
  resolvedAt,
  createdAt
}) {
  const { t } = useTranslation();
  const [now, setNow] = useState(new Date());

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const calculateSLAStatus = (targetHours, completedAt, startTime) => {
    if (!targetHours) return null;

    const start = new Date(startTime);
    const target = new Date(start.getTime() + targetHours * 60 * 60 * 1000);

    if (completedAt) {
      const completed = new Date(completedAt);
      const met = completed <= target;
      const diff = Math.abs(target - completed);
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      return {
        met,
        completed: true,
        message: met
          ? t('tickets.slaMet', 'Met ({{time}} early)', { time: `${hours}h ${minutes}m` })
          : t('tickets.slaBreached', 'Breached by {{time}}', { time: `${hours}h ${minutes}m` })
      };
    }

    // Not completed yet
    const remaining = target - now;
    const breached = remaining < 0;

    if (breached) {
      const overdue = Math.abs(remaining);
      const hours = Math.floor(overdue / (1000 * 60 * 60));
      const minutes = Math.floor((overdue % (1000 * 60 * 60)) / (1000 * 60));
      return {
        met: false,
        completed: false,
        breached: true,
        message: t('tickets.slaOverdue', 'Overdue by {{time}}', { time: `${hours}h ${minutes}m` })
      };
    }

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const warning = remaining < targetHours * 60 * 60 * 1000 * 0.25; // Less than 25% time remaining

    return {
      met: false,
      completed: false,
      breached: false,
      warning,
      remaining: { hours, minutes },
      message: t('tickets.slaRemaining', '{{hours}}h {{minutes}}m remaining', { hours, minutes })
    };
  };

  const firstResponseStatus = calculateSLAStatus(firstResponseTarget, firstResponseAt, createdAt);
  const resolutionStatus = calculateSLAStatus(resolutionTarget, resolvedAt, createdAt);

  const getStatusIcon = (status) => {
    if (!status) return null;

    if (status.completed && status.met) {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
    if (status.breached || (status.completed && !status.met)) {
      return <XCircle className="w-5 h-5 text-red-500" />;
    }
    if (status.warning) {
      return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    }
    return <Clock className="w-5 h-5 text-green-500" />;
  };

  const getProgressWidth = (status, targetHours) => {
    if (!status || !targetHours) return 0;

    if (status.completed) return 100;
    if (status.breached) return 100;

    const totalMs = targetHours * 60 * 60 * 1000;
    const remainingMs = (status.remaining?.hours || 0) * 60 * 60 * 1000 + (status.remaining?.minutes || 0) * 60 * 1000;
    const elapsed = totalMs - remainingMs;

    return Math.min(100, (elapsed / totalMs) * 100);
  };

  const getProgressColor = (status) => {
    if (!status) return 'bg-gray-300';
    if (status.completed && status.met) return 'bg-green-500';
    if (status.breached || (status.completed && !status.met)) return 'bg-red-500';
    if (status.warning) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (!firstResponseTarget && !resolutionTarget) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-purple-600" />
          {t('tickets.slaStatus', 'SLA Status')}
        </CardTitle>
      </CardHeader>
      <div className="p-4 space-y-4">
        {/* First Response SLA */}
        {firstResponseTarget && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('tickets.firstResponse', 'First Response')}
              </span>
              {getStatusIcon(firstResponseStatus)}
            </div>
            <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full ${getProgressColor(firstResponseStatus)} transition-all duration-300`}
                style={{ width: `${getProgressWidth(firstResponseStatus, firstResponseTarget)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {t('tickets.slaTarget', 'Target: {{hours}}h', { hours: firstResponseTarget })}
              </span>
              <span className={`text-xs font-medium ${
                firstResponseStatus?.breached || (firstResponseStatus?.completed && !firstResponseStatus?.met)
                  ? 'text-red-500'
                  : firstResponseStatus?.warning
                    ? 'text-yellow-500'
                    : 'text-green-500'
              }`}>
                {firstResponseStatus?.message}
              </span>
            </div>
          </div>
        )}

        {/* Resolution SLA */}
        {resolutionTarget && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('tickets.resolution', 'Resolution')}
              </span>
              {getStatusIcon(resolutionStatus)}
            </div>
            <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full ${getProgressColor(resolutionStatus)} transition-all duration-300`}
                style={{ width: `${getProgressWidth(resolutionStatus, resolutionTarget)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {t('tickets.slaTarget', 'Target: {{hours}}h', { hours: resolutionTarget })}
              </span>
              <span className={`text-xs font-medium ${
                resolutionStatus?.breached || (resolutionStatus?.completed && !resolutionStatus?.met)
                  ? 'text-red-500'
                  : resolutionStatus?.warning
                    ? 'text-yellow-500'
                    : 'text-green-500'
              }`}>
                {resolutionStatus?.message}
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
