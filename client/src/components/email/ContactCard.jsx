import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MoreHorizontal, Mail, Phone, Building2, CheckSquare, Square } from 'lucide-react';
import ContactAvatar from './ContactAvatar';
import ContactStatusBadge from './ContactStatusBadge';

const ContactCard = ({
  contact,
  isSelected = false,
  onSelect,
  onClick,
  compact = false
}) => {
  const { t } = useTranslation();
  const [showMenu, setShowMenu] = useState(false);

  const fullName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim();

  // Source icon/label
  const getSourceLabel = (source) => {
    const sources = {
      manual: t('email.contact.sourceManual', 'Manual'),
      import: t('email.contact.sourceImport', 'Import'),
      chatbot: t('email.contact.sourceChatbot', 'Chatbot'),
      form: t('email.contact.sourceForm', 'Form'),
      api: t('email.contact.sourceAPI', 'API')
    };
    return sources[source] || source;
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  };

  // Tags display
  const displayTags = (contact.tags || []).slice(0, 3);
  const remainingTags = (contact.tags || []).length - 3;

  if (compact) {
    return (
      <tr
        onClick={onClick}
        className="hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer"
      >
        {onSelect && (
          <td className="px-4 py-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
              }}
              className="p-1 hover:bg-gray-200 dark:hover:bg-slate-600 rounded"
            >
              {isSelected ? (
                <CheckSquare className="w-5 h-5 text-purple-600" />
              ) : (
                <Square className="w-5 h-5 text-gray-400" />
              )}
            </button>
          </td>
        )}
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <ContactAvatar
              email={contact.email}
              name={fullName}
              size="sm"
            />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                {fullName || contact.email}
              </p>
              {fullName && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{contact.email}</p>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <ContactStatusBadge status={contact.status} />
        </td>
        <td className="px-4 py-3 hidden md:table-cell text-sm text-gray-500 dark:text-gray-400">
          {formatDate(contact.created_at)}
        </td>
        <td className="px-4 py-3 text-right">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick && onClick();
            }}
            className="text-sm text-blue-600 hover:underline"
          >
            {t('email.contact.view', 'View')}
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr
      onClick={onClick}
      className="hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
    >
      <td className="px-4 py-4">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect && onSelect();
          }}
          className="p-1 hover:bg-gray-200 dark:hover:bg-slate-600 rounded"
        >
          {isSelected ? (
            <CheckSquare className="w-5 h-5 text-blue-600" />
          ) : (
            <Square className="w-5 h-5 text-gray-400" />
          )}
        </button>
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <ContactAvatar
            email={contact.email}
            name={fullName}
            status={contact.status}
          />
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              {fullName || contact.email}
            </p>
            {fullName && (
              <p className="text-sm text-gray-500 dark:text-gray-400">{contact.email}</p>
            )}
            {contact.company && (
              <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-0.5">
                <Building2 className="w-3 h-3" />
                {contact.company}
              </p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-4">
        <ContactStatusBadge status={contact.status} />
      </td>
      <td className="px-4 py-4 hidden md:table-cell">
        {displayTags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {displayTags.map((tag, i) => (
              <span
                key={i}
                className="px-2 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 text-xs rounded-full"
              >
                {tag}
              </span>
            ))}
            {remainingTags > 0 && (
              <span className="px-2 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 text-xs rounded-full">
                +{remainingTags}
              </span>
            )}
          </div>
        ) : (
          <span className="text-gray-400 dark:text-gray-500 text-sm">-</span>
        )}
      </td>
      <td className="px-4 py-4 hidden lg:table-cell">
        <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
          {getSourceLabel(contact.source)}
        </span>
      </td>
      <td className="px-4 py-4 hidden lg:table-cell text-sm text-gray-500 dark:text-gray-400">
        {formatDate(contact.created_at)}
      </td>
      <td className="px-4 py-4 text-right">
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-600 rounded-lg"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                }}
              />
              <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 py-1 z-20">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onClick && onClick();
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  {t('email.contact.view', 'View')}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    // Edit action
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  {t('email.contact.edit', 'Edit')}
                </button>
                <hr className="my-1 border-gray-200 dark:border-slate-700" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    // Delete action
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  {t('email.contact.delete', 'Delete')}
                </button>
              </div>
            </>
          )}
        </div>
      </td>
    </tr>
  );
};

export default ContactCard;
