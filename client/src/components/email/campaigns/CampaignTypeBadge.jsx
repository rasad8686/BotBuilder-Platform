import React from 'react';
import { Radio, RefreshCw, Droplets } from 'lucide-react';

const CampaignTypeBadge = ({ type, size = 'md' }) => {
  const config = {
    broadcast: {
      color: 'bg-purple-100 text-purple-700',
      icon: Radio,
      label: 'Broadcast'
    },
    automated: {
      color: 'bg-blue-100 text-blue-700',
      icon: RefreshCw,
      label: 'Automated'
    },
    drip: {
      color: 'bg-teal-100 text-teal-700',
      icon: Droplets,
      label: 'Drip'
    }
  };

  const { color, icon: Icon, label } = config[type] || {
    color: 'bg-gray-100 text-gray-700',
    icon: Radio,
    label: type
  };

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-0.5 text-xs',
    lg: 'px-2.5 py-1 text-sm'
  };

  const iconSizes = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-3.5 h-3.5'
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-medium ${color} ${sizeClasses[size]}`}
    >
      <Icon className={iconSizes[size]} />
      {label}
    </span>
  );
};

export default CampaignTypeBadge;
