import React from 'react';
import {
  Edit2,
  Clock,
  RefreshCw,
  CheckCircle,
  Pause,
  XCircle,
  AlertCircle
} from 'lucide-react';

const CampaignStatusBadge = ({ status, size = 'md' }) => {
  const config = {
    draft: {
      color: 'bg-gray-100 text-gray-700',
      icon: Edit2,
      label: 'Draft'
    },
    scheduled: {
      color: 'bg-blue-100 text-blue-700',
      icon: Clock,
      label: 'Scheduled'
    },
    sending: {
      color: 'bg-yellow-100 text-yellow-700',
      icon: RefreshCw,
      label: 'Sending',
      animate: true
    },
    sent: {
      color: 'bg-green-100 text-green-700',
      icon: CheckCircle,
      label: 'Sent'
    },
    paused: {
      color: 'bg-orange-100 text-orange-700',
      icon: Pause,
      label: 'Paused'
    },
    cancelled: {
      color: 'bg-red-100 text-red-700',
      icon: XCircle,
      label: 'Cancelled'
    }
  };

  const { color, icon: Icon, label, animate } = config[status] || {
    color: 'bg-gray-100 text-gray-700',
    icon: AlertCircle,
    label: status
  };

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${color} ${sizeClasses[size]}`}
    >
      <Icon className={`${iconSizes[size]} ${animate ? 'animate-spin' : ''}`} />
      {label}
    </span>
  );
};

export default CampaignStatusBadge;
