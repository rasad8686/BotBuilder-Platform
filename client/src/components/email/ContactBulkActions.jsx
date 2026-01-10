import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ListPlus, Tag, Trash2, Download, X, MinusCircle } from 'lucide-react';

const ContactBulkActions = ({
  selectedCount,
  onAddToList,
  onAddTags,
  onRemoveTags,
  onDelete,
  onExport,
  onClear
}) => {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            {t('email.bulk.selected', '{{count}} selected', { count: selectedCount })}
          </span>
          <button
            onClick={onClear}
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {t('email.bulk.clear', 'Clear')}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Add to List */}
          <button
            onClick={onAddToList}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/30 rounded-lg transition-colors"
          >
            <ListPlus className="w-4 h-4" />
            <span className="hidden sm:inline">{t('email.bulk.addToList', 'Add to List')}</span>
          </button>

          {/* Add Tags */}
          <button
            onClick={onAddTags}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/30 rounded-lg transition-colors"
          >
            <Tag className="w-4 h-4" />
            <span className="hidden sm:inline">{t('email.bulk.addTags', 'Add Tags')}</span>
          </button>

          {/* Remove Tags */}
          <button
            onClick={onRemoveTags}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/30 rounded-lg transition-colors"
          >
            <MinusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">{t('email.bulk.removeTags', 'Remove Tags')}</span>
          </button>

          {/* Export */}
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/30 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{t('email.bulk.export', 'Export')}</span>
          </button>

          {/* Delete */}
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">{t('email.bulk.delete', 'Delete')}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ContactBulkActions;
