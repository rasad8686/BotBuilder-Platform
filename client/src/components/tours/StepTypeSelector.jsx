import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Maximize2,
  MousePointer,
  PanelRightOpen,
  Zap,
  Check
} from 'lucide-react';

const STEP_TYPES = [
  {
    type: 'tooltip',
    icon: MessageSquare,
    label: 'Tooltip',
    description: 'Small popup attached to an element. Best for quick tips.',
    color: 'purple'
  },
  {
    type: 'modal',
    icon: Maximize2,
    label: 'Modal',
    description: 'Centered dialog box. Good for important information.',
    color: 'blue'
  },
  {
    type: 'hotspot',
    icon: MousePointer,
    label: 'Hotspot',
    description: 'Pulsing beacon on an element. Draws attention.',
    color: 'amber'
  },
  {
    type: 'slideout',
    icon: PanelRightOpen,
    label: 'Slideout',
    description: 'Panel that slides from the side. For detailed content.',
    color: 'green'
  },
  {
    type: 'driven',
    icon: Zap,
    label: 'Driven Action',
    description: 'Requires user to perform an action to continue.',
    color: 'pink'
  }
];

export default function StepTypeSelector({ selected, onSelect }) {
  const { t } = useTranslation();

  const colorClasses = {
    purple: {
      bg: 'bg-purple-100 dark:bg-purple-900/30',
      text: 'text-purple-600 dark:text-purple-400',
      border: 'border-purple-500',
      hover: 'hover:border-purple-300 dark:hover:border-purple-700'
    },
    blue: {
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-blue-600 dark:text-blue-400',
      border: 'border-blue-500',
      hover: 'hover:border-blue-300 dark:hover:border-blue-700'
    },
    amber: {
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      text: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-500',
      hover: 'hover:border-amber-300 dark:hover:border-amber-700'
    },
    green: {
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-600 dark:text-green-400',
      border: 'border-green-500',
      hover: 'hover:border-green-300 dark:hover:border-green-700'
    },
    pink: {
      bg: 'bg-pink-100 dark:bg-pink-900/30',
      text: 'text-pink-600 dark:text-pink-400',
      border: 'border-pink-500',
      hover: 'hover:border-pink-300 dark:hover:border-pink-700'
    }
  };

  return (
    <div className="grid grid-cols-1 gap-3">
      {STEP_TYPES.map((stepType, index) => {
        const isSelected = selected === stepType.type;
        const colors = colorClasses[stepType.color];
        const Icon = stepType.icon;

        return (
          <motion.button
            key={stepType.type}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onSelect(stepType.type)}
            className={`
              relative flex items-start gap-4 p-4 rounded-xl
              border-2 transition-all duration-200
              ${isSelected
                ? `${colors.border} bg-white dark:bg-slate-800`
                : `border-gray-200 dark:border-slate-700 ${colors.hover} bg-white dark:bg-slate-800`
              }
            `}
          >
            {/* Icon */}
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors.bg}`}>
              <Icon className={`w-6 h-6 ${colors.text}`} />
            </div>

            {/* Content */}
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  {stepType.label}
                </h4>
                {isSelected && (
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center ${colors.bg}`}>
                    <Check className={`w-3 h-3 ${colors.text}`} />
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {stepType.description}
              </p>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
