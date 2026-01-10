import { useTranslation } from 'react-i18next';
import { Badge } from '../ui/Badge';

export default function TicketStatusBadge({ status, size = 'default' }) {
  const { t } = useTranslation();

  const statusConfig = {
    open: {
      label: t('tickets.statusOpen', 'Open'),
      variant: 'primary'
    },
    pending: {
      label: t('tickets.statusPending', 'Pending'),
      variant: 'warning'
    },
    resolved: {
      label: t('tickets.statusResolved', 'Resolved'),
      variant: 'success'
    },
    closed: {
      label: t('tickets.statusClosed', 'Closed'),
      variant: 'secondary'
    }
  };

  const config = statusConfig[status] || statusConfig.open;

  return (
    <Badge variant={config.variant} size={size}>
      {config.label}
    </Badge>
  );
}
