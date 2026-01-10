import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Send, Eye, MousePointer, AlertTriangle, UserPlus, Tag,
  ListPlus, Mail, Clock, ExternalLink
} from 'lucide-react';

const ContactActivityTimeline = ({ contactId, activities = [] }) => {
  const { t } = useTranslation();

  // Activity type configurations
  const activityConfig = {
    email_sent: {
      icon: Send,
      color: 'bg-blue-500',
      label: t('email.activity.emailSent', 'Email sent')
    },
    email_opened: {
      icon: Eye,
      color: 'bg-green-500',
      label: t('email.activity.emailOpened', 'Email opened')
    },
    email_clicked: {
      icon: MousePointer,
      color: 'bg-purple-500',
      label: t('email.activity.emailClicked', 'Link clicked')
    },
    email_bounced: {
      icon: AlertTriangle,
      color: 'bg-red-500',
      label: t('email.activity.emailBounced', 'Email bounced')
    },
    subscribed: {
      icon: UserPlus,
      color: 'bg-green-500',
      label: t('email.activity.subscribed', 'Subscribed')
    },
    unsubscribed: {
      icon: Mail,
      color: 'bg-gray-500',
      label: t('email.activity.unsubscribed', 'Unsubscribed')
    },
    tag_added: {
      icon: Tag,
      color: 'bg-indigo-500',
      label: t('email.activity.tagAdded', 'Tag added')
    },
    tag_removed: {
      icon: Tag,
      color: 'bg-gray-400',
      label: t('email.activity.tagRemoved', 'Tag removed')
    },
    list_added: {
      icon: ListPlus,
      color: 'bg-teal-500',
      label: t('email.activity.listAdded', 'Added to list')
    },
    list_removed: {
      icon: ListPlus,
      color: 'bg-gray-400',
      label: t('email.activity.listRemoved', 'Removed from list')
    }
  };

  // Format relative time
  const formatRelativeTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t('email.activity.justNow', 'Just now');
    if (minutes < 60) return t('email.activity.minutesAgo', '{{count}} min ago', { count: minutes });
    if (hours < 24) return t('email.activity.hoursAgo', '{{count}} hours ago', { count: hours });
    if (days < 7) return t('email.activity.daysAgo', '{{count}} days ago', { count: days });

    return date.toLocaleDateString();
  };

  if (activities.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          {t('email.activity.noActivity', 'No activity yet')}
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          {t('email.activity.noActivityDesc', 'Activity will appear here when emails are sent to this contact.')}
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-slate-700" />

      {/* Activities */}
      <div className="space-y-6">
        {activities.map((activity, index) => {
          const config = activityConfig[activity.type] || {
            icon: Clock,
            color: 'bg-gray-500',
            label: activity.type
          };
          const Icon = config.icon;

          return (
            <div key={activity.id || index} className="relative flex gap-4">
              {/* Icon */}
              <div className={`
                relative z-10 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
                ${config.color}
              `}>
                <Icon className="w-4 h-4 text-white" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {config.label}
                    </p>

                    {/* Activity details based on type */}
                    {activity.type === 'email_sent' && activity.campaign && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t('email.activity.campaign', 'Campaign')}: {activity.campaign.name}
                      </p>
                    )}

                    {activity.type === 'email_clicked' && activity.link && (
                      <a
                        href={activity.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                      >
                        {activity.link}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}

                    {activity.type === 'tag_added' && activity.tag && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 text-xs rounded-full">
                        {activity.tag}
                      </span>
                    )}

                    {activity.type === 'list_added' && activity.list && (
                      <Link
                        to={`/email/lists/${activity.list.id}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        {activity.list.name}
                      </Link>
                    )}

                    {activity.details && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {activity.details}
                      </p>
                    )}
                  </div>

                  <span className="text-sm text-gray-400 dark:text-gray-500 whitespace-nowrap">
                    {formatRelativeTime(activity.created_at)}
                  </span>
                </div>

                {/* Campaign link */}
                {activity.campaign && (
                  <Link
                    to={`/email/campaigns/${activity.campaign.id}`}
                    className="inline-flex items-center gap-1 mt-2 text-sm text-blue-600 hover:underline"
                  >
                    {t('email.activity.viewCampaign', 'View campaign')}
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ContactActivityTimeline;
