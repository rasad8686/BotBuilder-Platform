import { useTranslation } from 'react-i18next';
import { Badge } from '../ui/Badge';

export default function ABTestStatusBadge({ status, size = 'default' }) {
  const { t } = useTranslation();

  const statusConfig = {
    draft: {
      label: t('abTests.draft', 'Draft'),
      variant: 'secondary'
    },
    running: {
      label: t('abTests.running', 'Running'),
      variant: 'success'
    },
    paused: {
      label: t('abTests.paused', 'Paused'),
      variant: 'warning'
    },
    completed: {
      label: t('abTests.completed', 'Completed'),
      variant: 'default'
    }
  };

  const config = statusConfig[status] || statusConfig.draft;

  return (
    <Badge variant={config.variant} size={size}>
      {status === 'running' && (
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse mr-1.5" />
      )}
      {config.label}
    </Badge>
  );
}
