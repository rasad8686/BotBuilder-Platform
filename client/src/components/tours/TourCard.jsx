import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  MoreVertical,
  Edit2,
  Copy,
  Trash2,
  Play,
  Pause,
  Archive,
  BarChart3,
  Eye,
  Map
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge, StatusBadge } from '../ui/Badge';
import { IconButton } from '../ui/Button';

export default function TourCard({
  tour,
  onEdit,
  onDuplicate,
  onDelete,
  onPublish,
  onPause,
  onViewAnalytics
}) {
  const { t } = useTranslation();
  const [showMenu, setShowMenu] = useState(false);

  const statusConfig = {
    draft: { variant: 'default', label: t('tours.draft', 'Draft') },
    active: { variant: 'success', label: t('tours.active', 'Active') },
    paused: { variant: 'warning', label: t('tours.paused', 'Paused') },
    archived: { variant: 'default', label: t('tours.archived', 'Archived') }
  };

  const status = statusConfig[tour.status] || statusConfig.draft;

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        hover
        className="relative group cursor-pointer"
        onClick={onEdit}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Map className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-1">
                {tour.name}
              </h3>
              <Badge variant={status.variant} size="sm">
                {status.label}
              </Badge>
            </div>
          </div>

          {/* Actions Menu */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <IconButton
              icon={MoreVertical}
              variant="ghost"
              size="sm"
              onClick={() => setShowMenu(!showMenu)}
              label="Actions"
            />

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 py-1 z-20">
                  <MenuItem
                    icon={Edit2}
                    label={t('common.edit', 'Edit')}
                    onClick={() => { setShowMenu(false); onEdit?.(); }}
                  />
                  <MenuItem
                    icon={Copy}
                    label={t('common.duplicate', 'Duplicate')}
                    onClick={() => { setShowMenu(false); onDuplicate?.(); }}
                  />
                  <MenuItem
                    icon={BarChart3}
                    label={t('tours.analytics', 'Analytics')}
                    onClick={() => { setShowMenu(false); onViewAnalytics?.(); }}
                  />

                  <div className="my-1 border-t border-gray-200 dark:border-slate-700" />

                  {tour.status === 'active' ? (
                    <MenuItem
                      icon={Pause}
                      label={t('tours.pause', 'Pause')}
                      onClick={() => { setShowMenu(false); onPause?.(); }}
                    />
                  ) : tour.status !== 'archived' && (
                    <MenuItem
                      icon={Play}
                      label={t('tours.publish', 'Publish')}
                      onClick={() => { setShowMenu(false); onPublish?.(); }}
                      className="text-green-600 dark:text-green-400"
                    />
                  )}

                  <div className="my-1 border-t border-gray-200 dark:border-slate-700" />

                  <MenuItem
                    icon={Trash2}
                    label={t('common.delete', 'Delete')}
                    onClick={() => { setShowMenu(false); onDelete?.(); }}
                    className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Description */}
        {tour.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-4">
            {tour.description}
          </p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
            <Map className="w-4 h-4" />
            <span>{tour.steps?.length || 0} {t('tours.steps', 'steps')}</span>
          </div>

          {tour.analytics && (
            <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
              <Eye className="w-4 h-4" />
              <span>{tour.analytics.impressions || 0}</span>
            </div>
          )}

          {tour.analytics?.completionRate && (
            <div className="flex items-center gap-1.5">
              <span className={`font-medium ${
                tour.analytics.completionRate >= 50
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}>
                {tour.analytics.completionRate}%
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
          <span>{t('common.created', 'Created')} {formatDate(tour.created_at)}</span>
          {tour.updated_at !== tour.created_at && (
            <span>{t('common.updated', 'Updated')} {formatDate(tour.updated_at)}</span>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

function MenuItem({ icon: Icon, label, onClick, className = '' }) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-2 px-3 py-2 text-sm text-left
        text-gray-700 dark:text-gray-300
        hover:bg-gray-100 dark:hover:bg-slate-700
        transition-colors
        ${className}
      `}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}
