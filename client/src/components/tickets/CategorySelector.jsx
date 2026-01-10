import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  FolderTree,
  ChevronDown,
  Check,
  Settings
} from 'lucide-react';

export default function CategorySelector({
  value,
  onChange,
  categories,
  disabled
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Get selected category
  const selectedCategory = categories.find(c => c.id === value);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (categoryId) => {
    onChange(categoryId);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between px-3 py-2 rounded-lg border
          ${disabled
            ? 'bg-gray-100 dark:bg-slate-800 cursor-not-allowed'
            : 'bg-white dark:bg-slate-900 cursor-pointer hover:border-purple-500'
          }
          border-gray-300 dark:border-slate-600
          text-gray-900 dark:text-white
          transition-colors
        `}
      >
        <div className="flex items-center gap-2">
          {selectedCategory ? (
            <>
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: selectedCategory.color || '#7c3aed' }}
              />
              <span className="text-sm">{selectedCategory.name}</span>
            </>
          ) : (
            <>
              <FolderTree className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {t('tickets.selectCategory', 'Select category')}
              </span>
            </>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-20 mt-1 w-full bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            {/* No Category Option */}
            <button
              onClick={() => handleSelect('')}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 text-left"
            >
              <FolderTree className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {t('tickets.noCategory', 'No category')}
              </span>
              {!value && <Check className="w-4 h-4 text-purple-600 ml-auto" />}
            </button>

            <div className="border-t border-gray-200 dark:border-slate-700 my-1" />

            {/* Category List */}
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => handleSelect(category.id)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 text-left"
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: category.color || '#7c3aed' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {category.name}
                  </p>
                  {category.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {category.description}
                    </p>
                  )}
                </div>
                {value === category.id && <Check className="w-4 h-4 text-purple-600" />}
              </button>
            ))}

            {categories.length === 0 && (
              <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                {t('tickets.noCategories', 'No categories')}
              </div>
            )}
          </div>

          {/* Manage Categories Link */}
          <div className="border-t border-gray-200 dark:border-slate-700">
            <button
              onClick={() => navigate('/tickets/settings?tab=categories')}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
            >
              <Settings className="w-4 h-4" />
              {t('tickets.manageCategories', 'Manage categories')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
