import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const VARIANT_COLORS = [
  '#7c3aed', // purple
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // orange
  '#ec4899', // pink
  '#06b6d4'  // cyan
];

export default function ConversionChart({ data, variants }) {
  const { t } = useTranslation();

  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      // Generate mock data if no data available
      const days = 7;
      const mockData = [];
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (days - i - 1));
        const point = { date: date.toISOString().split('T')[0] };
        variants.forEach((v, idx) => {
          point[v.id] = Math.random() * 10 + 2;
        });
        mockData.push(point);
      }
      return mockData;
    }
    return data;
  }, [data, variants]);

  const maxValue = useMemo(() => {
    let max = 0;
    chartData.forEach(point => {
      variants.forEach(v => {
        if (point[v.id] > max) max = point[v.id];
      });
    });
    return Math.ceil(max * 1.1);
  }, [chartData, variants]);

  const yAxisLabels = useMemo(() => {
    const labels = [];
    const step = maxValue / 4;
    for (let i = 0; i <= 4; i++) {
      labels.push(Math.round(step * i));
    }
    return labels;
  }, [maxValue]);

  return (
    <div className="h-64">
      {/* Y Axis Labels */}
      <div className="flex h-full">
        <div className="flex flex-col justify-between pr-2 text-xs text-gray-500 dark:text-gray-400">
          {yAxisLabels.reverse().map((label, i) => (
            <span key={i}>{label}%</span>
          ))}
        </div>

        {/* Chart Area */}
        <div className="flex-1 relative border-l border-b border-gray-200 dark:border-slate-700">
          {/* Grid Lines */}
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="absolute w-full border-t border-gray-100 dark:border-slate-800"
              style={{ top: `${i * 25}%` }}
            />
          ))}

          {/* Data Points and Lines */}
          <svg className="absolute inset-0 w-full h-full overflow-visible">
            {variants.map((variant, variantIdx) => {
              const points = chartData.map((point, i) => {
                const x = (i / (chartData.length - 1)) * 100;
                const y = 100 - ((point[variant.id] || 0) / maxValue) * 100;
                return `${x},${y}`;
              }).join(' ');

              return (
                <g key={variant.id}>
                  {/* Line */}
                  <polyline
                    points={points}
                    fill="none"
                    stroke={VARIANT_COLORS[variantIdx % VARIANT_COLORS.length]}
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                  {/* Points */}
                  {chartData.map((point, i) => {
                    const x = (i / (chartData.length - 1)) * 100;
                    const y = 100 - ((point[variant.id] || 0) / maxValue) * 100;
                    return (
                      <circle
                        key={i}
                        cx={`${x}%`}
                        cy={`${y}%`}
                        r="4"
                        fill={VARIANT_COLORS[variantIdx % VARIANT_COLORS.length]}
                      />
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* X Axis Labels */}
      <div className="flex justify-between mt-2 ml-8 text-xs text-gray-500 dark:text-gray-400">
        {chartData.map((point, i) => (
          <span key={i}>
            {new Date(point.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
          </span>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4">
        {variants.map((variant, idx) => (
          <div key={variant.id} className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: VARIANT_COLORS[idx % VARIANT_COLORS.length] }}
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {variant.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
