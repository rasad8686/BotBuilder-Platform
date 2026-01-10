import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Users, MoreHorizontal, Edit2, Copy, Trash2, Zap } from 'lucide-react';

const ListCard = ({
  list,
  onClick,
  onEdit,
  onDuplicate,
  onDelete
}) => {
  const { t } = useTranslation();
  const [showMenu, setShowMenu] = useState(false);

  // Format count
  const formatCount = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <motion.div
      onClick={onClick}
      className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5 cursor-pointer hover:shadow-md transition-shadow border border-gray-100 dark:border-slate-700"
      whileHover={{ y: -2 }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`
          p-2 rounded-lg
          ${list.type === 'dynamic'
            ? 'bg-blue-100 dark:bg-blue-900/30'
            : 'bg-purple-100 dark:bg-purple-900/30'
          }
        `}>
          {list.type === 'dynamic' ? (
            <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          ) : (
            <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          )}
        </div>

        {/* Actions Menu */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                }}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute right-0 mt-1 w-40 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 py-1 z-20"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onEdit && onEdit();
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  {t('email.list.edit', 'Edit')}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onDuplicate && onDuplicate();
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  {t('email.list.duplicate', 'Duplicate')}
                </button>
                <hr className="my-1 border-gray-200 dark:border-slate-700" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onDelete && onDelete();
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {t('email.list.delete', 'Delete')}
                </button>
              </motion.div>
            </>
          )}
        </div>
      </div>

      <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
        {list.name}
      </h3>

      {list.description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
          {list.description}
        </p>
      )}

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-slate-700">
        <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
          <Users className="w-4 h-4" />
          <span className="text-sm font-medium">
            {formatCount(list.contact_count || 0)}
          </span>
          <span className="text-sm">
            {t('email.list.contacts', 'contacts')}
          </span>
        </div>

        <span className={`
          px-2 py-1 text-xs font-medium rounded-full
          ${list.type === 'dynamic'
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-400'
          }
        `}>
          {list.type === 'dynamic'
            ? t('email.list.dynamic', 'Dynamic')
            : t('email.list.static', 'Static')
          }
        </span>
      </div>
    </motion.div>
  );
};

export default ListCard;
