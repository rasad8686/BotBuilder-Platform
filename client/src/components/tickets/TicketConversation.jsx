import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../ui/Button';
import CommentBubble from './CommentBubble';

export default function TicketConversation({
  comments,
  ticketDescription,
  ticketCreatedAt,
  requesterName
}) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);

  // Combine initial ticket description with comments
  const allMessages = [
    {
      id: 'initial',
      content: ticketDescription,
      created_at: ticketCreatedAt,
      author: {
        name: requesterName || t('tickets.customer', 'Customer'),
        type: 'customer'
      },
      is_internal: false,
      is_initial: true
    },
    ...comments
  ];

  const displayMessages = showAll ? allMessages : allMessages.slice(-5);
  const hiddenCount = allMessages.length - displayMessages.length;

  return (
    <div className="space-y-4">
      {/* Show More Button */}
      {hiddenCount > 0 && (
        <div className="text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(true)}
            icon={ChevronUp}
          >
            {t('tickets.showMoreMessages', 'Show {{count}} more messages', { count: hiddenCount })}
          </Button>
        </div>
      )}

      {/* Messages */}
      {displayMessages.map((message, index) => (
        <CommentBubble
          key={message.id}
          comment={message}
          isFirst={index === 0 && showAll}
        />
      ))}

      {/* Show Less Button */}
      {showAll && allMessages.length > 5 && (
        <div className="text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(false)}
            icon={ChevronDown}
          >
            {t('tickets.showLess', 'Show less')}
          </Button>
        </div>
      )}
    </div>
  );
}
