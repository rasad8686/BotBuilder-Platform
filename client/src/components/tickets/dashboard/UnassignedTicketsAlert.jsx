import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '../../ui/Button';

export default function UnassignedTicketsAlert({ count }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!count || count === 0) return null;

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-100 dark:bg-yellow-900/40 rounded-full">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div>
            <p className="font-medium text-yellow-800 dark:text-yellow-300">
              {t('tickets.unassignedAlert', '{{count}} Unassigned Tickets', { count })}
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              {t('tickets.unassignedAlertDescription', 'These tickets need to be assigned to an agent')}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/tickets?assignee=unassigned')}
          className="border-yellow-300 text-yellow-700 hover:bg-yellow-100 dark:border-yellow-700 dark:text-yellow-400 dark:hover:bg-yellow-900/30"
        >
          {t('tickets.viewUnassigned', 'View Unassigned')}
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
