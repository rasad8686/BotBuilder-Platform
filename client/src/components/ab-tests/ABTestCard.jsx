import { useTranslation } from 'react-i18next';
import {
  MoreVertical,
  Edit2,
  Copy,
  Trash2,
  Play,
  Pause,
  CheckCircle,
  BarChart3,
  Users,
  TrendingUp,
  Calendar
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import ABTestStatusBadge from './ABTestStatusBadge';

export default function ABTestCard({
  test,
  onEdit,
  onDuplicate,
  onDelete,
  onStart,
  onPause,
  onComplete,
  onViewResults
}) {
  const { t } = useTranslation();

  const getTestTypeLabel = (type) => {
    const types = {
      message: t('abTests.typeMessage', 'Message'),
      button: t('abTests.typeButton', 'Button'),
      widget: t('abTests.typeWidget', 'Widget'),
      welcome: t('abTests.typeWelcome', 'Welcome'),
      flow: t('abTests.typeFlow', 'Flow'),
      tour: t('abTests.typeTour', 'Tour')
    };
    return types[type] || type;
  };

  const isRunning = test.status === 'running';
  const isPaused = test.status === 'paused';
  const isCompleted = test.status === 'completed';
  const isDraft = test.status === 'draft';

  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                {test.name}
              </h3>
              <ABTestStatusBadge status={test.status} size="sm" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
              {test.description || t('abTests.noDescription', 'No description')}
            </p>
          </div>

          {/* Actions Menu */}
          <div className="relative group">
            <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreVertical className="w-4 h-4" />
            </Button>
            <div className="absolute right-0 top-full mt-1 w-48 py-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button
                onClick={onEdit}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700"
              >
                <Edit2 className="w-4 h-4" />
                {t('common.edit', 'Edit')}
              </button>
              <button
                onClick={onDuplicate}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700"
              >
                <Copy className="w-4 h-4" />
                {t('common.duplicate', 'Duplicate')}
              </button>
              {(isRunning || isCompleted) && (
                <button
                  onClick={onViewResults}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700"
                >
                  <BarChart3 className="w-4 h-4" />
                  {t('abTests.viewResults', 'View Results')}
                </button>
              )}
              <div className="border-t border-gray-200 dark:border-slate-700 my-1" />
              <button
                onClick={onDelete}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 className="w-4 h-4" />
                {t('common.delete', 'Delete')}
              </button>
            </div>
          </div>
        </div>

        {/* Test Type & Variants */}
        <div className="flex items-center gap-2 mb-4">
          <Badge variant="secondary" size="sm">
            {getTestTypeLabel(test.test_type)}
          </Badge>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {test.variants?.length || 0} {t('abTests.variants', 'variants')}
          </span>
        </div>

        {/* Stats */}
        {(isRunning || isPaused || isCompleted) && (
          <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-gray-500 dark:text-gray-400 mb-1">
                <Users className="w-3.5 h-3.5" />
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {test.total_visitors?.toLocaleString() || 0}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('abTests.visitors', 'Visitors')}
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-gray-500 dark:text-gray-400 mb-1">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {test.conversion_rate?.toFixed(1) || 0}%
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('abTests.conversionRate', 'Conv. Rate')}
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-gray-500 dark:text-gray-400 mb-1">
                <Calendar className="w-3.5 h-3.5" />
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {test.days_running || 0}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('abTests.daysRunning', 'Days')}
              </p>
            </div>
          </div>
        )}

        {/* Winner Badge */}
        {isCompleted && test.winner_variant && (
          <div className="mb-4 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="text-sm text-green-700 dark:text-green-300">
              {t('abTests.winner', 'Winner')}: {test.winner_variant.name}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {isDraft && (
            <Button
              variant="primary"
              size="sm"
              icon={Play}
              onClick={onStart}
              className="flex-1"
            >
              {t('abTests.startTest', 'Start Test')}
            </Button>
          )}

          {isRunning && (
            <>
              <Button
                variant="warning"
                size="sm"
                icon={Pause}
                onClick={onPause}
                className="flex-1"
              >
                {t('abTests.pause', 'Pause')}
              </Button>
              <Button
                variant="success"
                size="sm"
                icon={CheckCircle}
                onClick={onComplete}
                className="flex-1"
              >
                {t('abTests.complete', 'Complete')}
              </Button>
            </>
          )}

          {isPaused && (
            <>
              <Button
                variant="primary"
                size="sm"
                icon={Play}
                onClick={onStart}
                className="flex-1"
              >
                {t('abTests.resume', 'Resume')}
              </Button>
              <Button
                variant="success"
                size="sm"
                icon={CheckCircle}
                onClick={onComplete}
                className="flex-1"
              >
                {t('abTests.complete', 'Complete')}
              </Button>
            </>
          )}

          {isCompleted && (
            <Button
              variant="outline"
              size="sm"
              icon={BarChart3}
              onClick={onViewResults}
              className="flex-1"
            >
              {t('abTests.viewResults', 'View Results')}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
