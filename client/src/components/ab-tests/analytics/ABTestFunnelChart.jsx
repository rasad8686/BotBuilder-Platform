/**
 * ABTestFunnelChart Component
 * Side-by-side funnel visualization for variants
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

// Variant colors
const VARIANT_COLORS = {
  A: { bg: 'bg-blue-500', light: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' },
  B: { bg: 'bg-green-500', light: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400' },
  C: { bg: 'bg-amber-500', light: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400' },
  D: { bg: 'bg-purple-500', light: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400' }
};

/**
 * Single funnel stage
 */
function FunnelStage({ label, value, percentage, maxValue, color, dropOff }) {
  const width = maxValue > 0 ? (value / maxValue) * 100 : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-400">{label}</span>
        <span className="font-medium text-gray-900 dark:text-white">
          {value.toLocaleString()} ({percentage}%)
        </span>
      </div>
      <div className="h-8 bg-gray-100 dark:bg-slate-700 rounded-lg overflow-hidden relative">
        <div
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${width}%` }}
        />
        {dropOff > 0 && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-red-500 font-medium">
            -{dropOff}%
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Variant funnel column
 */
function VariantFunnel({ name, impressions, engagements, conversions, isControl, isWinner }) {
  const colors = VARIANT_COLORS[name] || VARIANT_COLORS.A;

  const stages = useMemo(() => {
    const imp = impressions || 0;
    const eng = engagements || imp; // If no engagement data, use impressions
    const conv = conversions || 0;

    return [
      {
        label: 'Impressions',
        value: imp,
        percentage: 100,
        dropOff: 0
      },
      {
        label: 'Engagements',
        value: eng,
        percentage: imp > 0 ? ((eng / imp) * 100).toFixed(1) : 0,
        dropOff: imp > 0 ? ((imp - eng) / imp * 100).toFixed(1) : 0
      },
      {
        label: 'Conversions',
        value: conv,
        percentage: imp > 0 ? ((conv / imp) * 100).toFixed(1) : 0,
        dropOff: eng > 0 ? ((eng - conv) / eng * 100).toFixed(1) : 0
      }
    ];
  }, [impressions, engagements, conversions]);

  const maxValue = impressions || 1;

  return (
    <div className={`flex-1 p-4 rounded-lg ${colors.light}`}>
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-4 h-4 rounded-full ${colors.bg}`} />
        <h4 className={`font-semibold ${colors.text}`}>
          Variant {name}
          {isControl && ' (Control)'}
        </h4>
        {isWinner && (
          <span className="ml-auto px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
            Winner
          </span>
        )}
      </div>

      <div className="space-y-4">
        {stages.map((stage, index) => (
          <FunnelStage
            key={stage.label}
            label={stage.label}
            value={stage.value}
            percentage={stage.percentage}
            maxValue={maxValue}
            color={colors.bg}
            dropOff={index > 0 ? stage.dropOff : 0}
          />
        ))}
      </div>

      {/* Conversion rate summary */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-600">
        <div className="text-center">
          <div className={`text-2xl font-bold ${colors.text}`}>
            {stages[2].percentage}%
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Conversion Rate
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ABTestFunnelChart Component
 * @param {Object} props
 * @param {Array} props.variants - Variant data [{ name, impressions, engagements, conversions, isControl }]
 * @param {string} props.winnerVariant - Winner variant name
 */
export default function ABTestFunnelChart({
  variants = [],
  winnerVariant = null
}) {
  const { t } = useTranslation();

  // Empty state
  if (!variants || variants.length === 0) {
    return (
      <div className="flex items-center justify-center bg-gray-50 dark:bg-slate-800 rounded-lg p-8">
        <div className="text-center">
          <div className="text-4xl mb-2 text-gray-400">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4h18M3 4v16h18V4M3 4l9 7 9-7" />
            </svg>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('abTests.noFunnelData', 'No funnel data available')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Funnels side by side */}
      <div className="flex gap-4">
        {variants.slice(0, 4).map((variant) => (
          <VariantFunnel
            key={variant.name || variant.variantName}
            name={variant.name || variant.variantName}
            impressions={variant.impressions}
            engagements={variant.engagements || variant.impressions}
            conversions={variant.conversions}
            isControl={variant.isControl}
            isWinner={winnerVariant === (variant.name || variant.variantName)}
          />
        ))}
      </div>

      {/* Drop-off summary */}
      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
        <h5 className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">
          Drop-off Analysis
        </h5>
        <div className="flex gap-4 text-sm">
          {variants.map((variant) => {
            const name = variant.name || variant.variantName;
            const imp = variant.impressions || 0;
            const conv = variant.conversions || 0;
            const dropOff = imp > 0 ? ((imp - conv) / imp * 100).toFixed(1) : 0;

            return (
              <div key={name} className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: VARIANT_COLORS[name]?.bg.replace('bg-', '#') || '#6B7280' }}
                />
                <span className="text-gray-600 dark:text-gray-400">
                  Variant {name}: <span className="text-red-600 font-medium">{dropOff}%</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
