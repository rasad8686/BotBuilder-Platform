import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, Reorder } from 'framer-motion';
import {
  Plus,
  GripVertical,
  Trash2,
  MessageSquare,
  Maximize2,
  MousePointer,
  PanelRightOpen,
  Zap
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';

const STEP_TYPES = {
  tooltip: { icon: MessageSquare, label: 'Tooltip', color: 'purple' },
  modal: { icon: Maximize2, label: 'Modal', color: 'blue' },
  hotspot: { icon: MousePointer, label: 'Hotspot', color: 'amber' },
  slideout: { icon: PanelRightOpen, label: 'Slideout', color: 'green' },
  driven: { icon: Zap, label: 'Driven Action', color: 'pink' }
};

export default function TourStepsList({
  steps,
  selectedIndex,
  onSelect,
  onAdd,
  onDelete,
  onReorder
}) {
  const { t } = useTranslation();

  const handleReorder = useCallback((newOrder) => {
    onReorder?.(newOrder);
  }, [onReorder]);

  return (
    <Card>
      <CardHeader
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={onAdd}
          >
            {t('tours.addStep', 'Add Step')}
          </Button>
        }
      >
        <CardTitle size="md">{t('tours.tourSteps', 'Tour Steps')}</CardTitle>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t('tours.stepsDescription', 'Drag to reorder. Click to edit.')}
        </p>
      </CardHeader>

      {steps.length === 0 ? (
        <div className="p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
            <MessageSquare className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="font-medium text-gray-900 dark:text-white mb-2">
            {t('tours.noSteps', 'No steps yet')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {t('tours.noStepsDesc', 'Add your first step to start building your tour.')}
          </p>
          <Button icon={Plus} onClick={onAdd}>
            {t('tours.addFirstStep', 'Add First Step')}
          </Button>
        </div>
      ) : (
        <Reorder.Group
          axis="y"
          values={steps}
          onReorder={handleReorder}
          className="space-y-2"
        >
          {steps.map((step, index) => (
            <StepItem
              key={step.id}
              step={step}
              index={index}
              isSelected={selectedIndex === index}
              onSelect={() => onSelect(index)}
              onDelete={() => onDelete(index)}
            />
          ))}
        </Reorder.Group>
      )}
    </Card>
  );
}

function StepItem({ step, index, isSelected, onSelect, onDelete }) {
  const { t } = useTranslation();
  const stepType = STEP_TYPES[step.type] || STEP_TYPES.tooltip;
  const Icon = stepType.icon;

  const colorClasses = {
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    pink: 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400'
  };

  return (
    <Reorder.Item
      value={step}
      as="div"
    >
      <motion.div
        layout
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -10 }}
        whileHover={{ x: 2 }}
        onClick={onSelect}
        className={`
          flex items-center gap-3 p-4 rounded-lg cursor-pointer
          transition-colors duration-150
          ${isSelected
            ? 'bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-500'
            : 'bg-gray-50 dark:bg-slate-800 border-2 border-transparent hover:border-gray-200 dark:hover:border-slate-600'
          }
        `}
      >
        {/* Drag Handle */}
        <div className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <GripVertical className="w-5 h-5" />
        </div>

        {/* Step Number */}
        <div className={`
          w-8 h-8 rounded-full flex items-center justify-center
          font-semibold text-sm
          ${isSelected
            ? 'bg-purple-600 text-white'
            : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300'
          }
        `}>
          {index + 1}
        </div>

        {/* Step Type Icon */}
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorClasses[stepType.color]}`}>
          <Icon className="w-4 h-4" />
        </div>

        {/* Step Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 dark:text-white truncate">
              {step.title || t('tours.untitledStep', 'Untitled Step')}
            </span>
            <Badge size="sm" variant="default">
              {stepType.label}
            </Badge>
          </div>
          {step.target && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
              {step.target}
            </p>
          )}
        </div>

        {/* Delete Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </motion.div>
    </Reorder.Item>
  );
}
