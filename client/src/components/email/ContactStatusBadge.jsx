import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X, AlertTriangle, Ban } from 'lucide-react';

const ContactStatusBadge = ({ status, size = 'md' }) => {
  const { t } = useTranslation();

  const statusConfig = {
    subscribed: {
      label: t('email.status.subscribed', 'Subscribed'),
      color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      icon: Check
    },
    unsubscribed: {
      label: t('email.status.unsubscribed', 'Unsubscribed'),
      color: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-400',
      icon: X
    },
    bounced: {
      label: t('email.status.bounced', 'Bounced'),
      color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      icon: AlertTriangle
    },
    complained: {
      label: t('email.status.complained', 'Complained'),
      color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      icon: Ban
    }
  };

  const config = statusConfig[status] || statusConfig.subscribed;
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4'
  };

  return (
    <span className={`
      inline-flex items-center gap-1 font-medium rounded-full
      ${config.color}
      ${sizeClasses[size]}
    `}>
      <Icon className={iconSizes[size]} />
      {config.label}
    </span>
  );
};

export default ContactStatusBadge;
