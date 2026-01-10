import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Shuffle, Lock, Unlock } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';

const VARIANT_COLORS = [
  'bg-purple-500',
  'bg-blue-500',
  'bg-green-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-cyan-500'
];

export default function TrafficSplitEditor({
  variants,
  onChange,
  disabled
}) {
  const { t } = useTranslation();
  const [locked, setLocked] = useState(false);
  const [splits, setSplits] = useState(variants.map(v => v.traffic_percentage));

  useEffect(() => {
    setSplits(variants.map(v => v.traffic_percentage));
  }, [variants]);

  const handleSplitChange = (index, value) => {
    if (disabled || locked) return;

    const newValue = Math.max(0, Math.min(100, parseInt(value) || 0));
    const newSplits = [...splits];
    const oldValue = newSplits[index];
    const diff = newValue - oldValue;

    newSplits[index] = newValue;

    // Distribute the difference to other variants
    const otherIndices = newSplits.map((_, i) => i).filter(i => i !== index);
    const remaining = otherIndices.reduce((sum, i) => sum + newSplits[i], 0);

    if (remaining + newValue !== 100) {
      // Adjust other splits proportionally
      const adjustment = 100 - newValue;
      otherIndices.forEach(i => {
        const proportion = newSplits[i] / remaining || 1 / otherIndices.length;
        newSplits[i] = Math.round(adjustment * proportion);
      });

      // Fix rounding errors
      const total = newSplits.reduce((sum, s) => sum + s, 0);
      if (total !== 100) {
        const lastOther = otherIndices[otherIndices.length - 1];
        newSplits[lastOther] += 100 - total;
      }
    }

    setSplits(newSplits);
    onChange(newSplits);
  };

  const handleEqualSplit = () => {
    if (disabled || locked) return;

    const count = variants.length;
    const equalSplit = Math.floor(100 / count);
    const remainder = 100 - (equalSplit * count);

    const newSplits = variants.map((_, i) => equalSplit + (i === 0 ? remainder : 0));
    setSplits(newSplits);
    onChange(newSplits);
  };

  const total = splits.reduce((sum, s) => sum + s, 0);
  const isValid = total === 100;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shuffle className="w-5 h-5 text-purple-600" />
            {t('abTests.trafficSplit', 'Traffic Split')}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon={locked ? Lock : Unlock}
              onClick={() => setLocked(!locked)}
              disabled={disabled}
            >
              {locked ? t('abTests.unlock', 'Unlock') : t('abTests.lock', 'Lock')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleEqualSplit}
              disabled={disabled || locked}
            >
              {t('abTests.equalSplit', 'Equal Split')}
            </Button>
          </div>
        </div>
      </CardHeader>

      <div className="p-6">
        {/* Visual Bar */}
        <div className="h-8 rounded-full overflow-hidden flex mb-6 bg-gray-100 dark:bg-slate-900">
          {variants.map((variant, index) => (
            <div
              key={variant.id}
              className={`${VARIANT_COLORS[index % VARIANT_COLORS.length]} transition-all duration-300 flex items-center justify-center text-xs font-medium text-white`}
              style={{ width: `${splits[index]}%` }}
            >
              {splits[index] >= 10 && `${splits[index]}%`}
            </div>
          ))}
        </div>

        {/* Sliders */}
        <div className="space-y-4">
          {variants.map((variant, index) => (
            <div key={variant.id} className="flex items-center gap-4">
              <div className="flex items-center gap-2 w-32">
                <span
                  className={`w-3 h-3 rounded-full ${VARIANT_COLORS[index % VARIANT_COLORS.length]}`}
                />
                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {variant.name}
                </span>
              </div>

              <input
                type="range"
                min="0"
                max="100"
                value={splits[index] ?? 0}
                onChange={(e) => handleSplitChange(index, e.target.value)}
                disabled={disabled || locked}
                className="flex-1 h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
              />

              <div className="w-20">
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={splits[index] ?? 0}
                    onChange={(e) => handleSplitChange(index, e.target.value)}
                    disabled={disabled || locked}
                    className="w-full px-3 py-1.5 text-sm text-right border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <span className="absolute right-8 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400">
                    %
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className={`mt-4 pt-4 border-t border-gray-200 dark:border-slate-700 flex justify-between items-center ${!isValid ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
          <span className="text-sm">
            {t('abTests.total', 'Total')}
          </span>
          <span className="text-sm font-medium">
            {total}%
            {!isValid && (
              <span className="ml-2">
                ({t('abTests.mustEqual100', 'Must equal 100%')})
              </span>
            )}
          </span>
        </div>
      </div>
    </Card>
  );
}
