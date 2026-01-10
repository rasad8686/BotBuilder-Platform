import React from 'react';
import { Mail, User } from 'lucide-react';

const CampaignPreview = ({ subject, content, device = 'desktop', sampleData = {} }) => {
  // Personalize content with sample data
  const personalizeContent = (text) => {
    if (!text) return '';
    return text
      .replace(/\{\{first_name\}\}/g, sampleData.first_name || 'John')
      .replace(/\{\{last_name\}\}/g, sampleData.last_name || 'Doe')
      .replace(/\{\{email\}\}/g, sampleData.email || 'john@example.com')
      .replace(/\{\{company\}\}/g, sampleData.company || 'Acme Inc')
      .replace(/\{\{full_name\}\}/g, `${sampleData.first_name || 'John'} ${sampleData.last_name || 'Doe'}`);
  };

  const personalizedSubject = personalizeContent(subject);
  const personalizedContent = personalizeContent(content);

  const containerClass = device === 'mobile'
    ? 'max-w-[375px] mx-auto'
    : 'max-w-full';

  return (
    <div className={`border border-gray-200 rounded-xl overflow-hidden bg-white ${containerClass}`}>
      {/* Email Header */}
      <div className="bg-gray-50 border-b border-gray-200 p-3">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">BotBuilder</p>
            <p className="text-xs text-gray-500 truncate">hello@botbuilder.com</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <p className={`font-medium text-gray-900 ${device === 'mobile' ? 'text-sm truncate' : ''}`}>
            {personalizedSubject || 'No subject'}
          </p>
        </div>
      </div>

      {/* Email Body */}
      <div
        className={`p-4 overflow-auto ${device === 'mobile' ? 'max-h-[400px]' : 'max-h-[500px]'}`}
      >
        {personalizedContent ? (
          <div
            className="email-preview-content"
            dangerouslySetInnerHTML={{ __html: personalizedContent }}
            style={{
              fontSize: device === 'mobile' ? '14px' : '16px',
              lineHeight: '1.5'
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Mail className="w-12 h-12 mb-2" />
            <p>No email content</p>
          </div>
        )}
      </div>

      {/* Sample Data Info */}
      <div className="bg-blue-50 border-t border-blue-100 p-2">
        <p className="text-xs text-blue-600 text-center">
          Preview with sample data. Personalization tags are replaced with example values.
        </p>
      </div>
    </div>
  );
};

export default CampaignPreview;
