import React, { useState } from 'react';
import { Link, Unlink } from 'lucide-react';

const PaddingEditor = ({ value, onChange }) => {
  const [linked, setLinked] = useState(false);

  const padding = value || { top: 0, right: 0, bottom: 0, left: 0 };

  const handleChange = (side, newValue) => {
    const numValue = parseInt(newValue) || 0;

    if (linked) {
      onChange({
        top: numValue,
        right: numValue,
        bottom: numValue,
        left: numValue
      });
    } else {
      onChange({
        ...padding,
        [side]: numValue
      });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Padding
        </label>
        <button
          onClick={() => setLinked(!linked)}
          className={`p-1.5 rounded ${
            linked
              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
          }`}
          title={linked ? 'Unlink values' : 'Link values'}
        >
          {linked ? <Link className="w-4 h-4" /> : <Unlink className="w-4 h-4" />}
        </button>
      </div>

      {/* Visual Editor */}
      <div className="relative bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <div className="flex flex-col items-center">
          {/* Top */}
          <input
            type="number"
            value={padding.top}
            onChange={(e) => handleChange('top', e.target.value)}
            className="w-16 px-2 py-1 text-center text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min="0"
          />

          <div className="flex items-center gap-2 my-2">
            {/* Left */}
            <input
              type="number"
              value={padding.left}
              onChange={(e) => handleChange('left', e.target.value)}
              className="w-16 px-2 py-1 text-center text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              min="0"
            />

            {/* Center Box */}
            <div className="w-24 h-16 bg-purple-100 dark:bg-purple-900/30 border-2 border-dashed border-purple-300 dark:border-purple-600 rounded flex items-center justify-center">
              <span className="text-xs text-purple-600 dark:text-purple-400">Content</span>
            </div>

            {/* Right */}
            <input
              type="number"
              value={padding.right}
              onChange={(e) => handleChange('right', e.target.value)}
              className="w-16 px-2 py-1 text-center text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              min="0"
            />
          </div>

          {/* Bottom */}
          <input
            type="number"
            value={padding.bottom}
            onChange={(e) => handleChange('bottom', e.target.value)}
            className="w-16 px-2 py-1 text-center text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min="0"
          />
        </div>
      </div>

      {/* Quick Presets */}
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onChange({ top: 0, right: 0, bottom: 0, left: 0 })}
          className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          None
        </button>
        <button
          onClick={() => onChange({ top: 10, right: 10, bottom: 10, left: 10 })}
          className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          S
        </button>
        <button
          onClick={() => onChange({ top: 20, right: 20, bottom: 20, left: 20 })}
          className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          M
        </button>
        <button
          onClick={() => onChange({ top: 30, right: 30, bottom: 30, left: 30 })}
          className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          L
        </button>
      </div>
    </div>
  );
};

export default PaddingEditor;
