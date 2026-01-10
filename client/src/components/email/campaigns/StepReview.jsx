import React, { useState } from 'react';
import {
  Mail,
  Users,
  FileText,
  Check,
  AlertTriangle,
  AlertCircle,
  Send,
  Clock,
  Monitor,
  Smartphone,
  Calendar,
  Globe
} from 'lucide-react';
import { useTestSendMutation, useEmailListsQuery } from '../../../hooks/email/useCampaigns';
import CampaignPreview from './CampaignPreview';
import TestSendModal from './TestSendModal';
import SendScheduler from './SendScheduler';
import PreSendChecklist from './PreSendChecklist';

const StepReview = ({ data, errors, onChange, onSend }) => {
  const [showTestModal, setShowTestModal] = useState(false);
  const [previewDevice, setPreviewDevice] = useState('desktop');

  const { data: listsData } = useEmailListsQuery();
  const lists = listsData?.lists || [];

  const selectedLists = lists.filter(l => data.list_ids?.includes(l.id));
  const estimatedRecipients = data.send_to === 'all'
    ? lists.reduce((sum, l) => sum + (l.contact_count || 0), 0)
    : selectedLists.reduce((sum, l) => sum + (l.contact_count || 0), 0);

  const checklist = [
    {
      id: 'subject',
      label: 'Subject line added',
      passed: !!data.subject?.trim(),
      required: true
    },
    {
      id: 'recipients',
      label: 'Recipients selected',
      passed: data.send_to === 'all' || data.list_ids?.length > 0,
      required: true
    },
    {
      id: 'content',
      label: 'Content ready',
      passed: !!(data.template_id || data.content_html?.trim()),
      required: true
    },
    {
      id: 'unsubscribe',
      label: 'Unsubscribe link present',
      passed: data.settings?.unsubscribeLink !== false,
      required: true
    },
    {
      id: 'abtest',
      label: 'A/B test configured',
      passed: false,
      required: false
    }
  ];

  const allRequiredPassed = checklist.filter(c => c.required).every(c => c.passed);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Review & Send</h2>
        <p className="text-sm text-gray-500">Review your campaign before sending</p>
      </div>

      {/* Campaign Summary */}
      <div className="bg-gray-50 rounded-xl p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Campaign Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex">
            <span className="w-24 text-gray-500">Name:</span>
            <span className="font-medium text-gray-900">{data.name || 'Untitled'}</span>
          </div>
          <div className="flex">
            <span className="w-24 text-gray-500">Type:</span>
            <span className="font-medium text-gray-900 capitalize">{data.type}</span>
          </div>
          <div className="flex">
            <span className="w-24 text-gray-500">From:</span>
            <span className="font-medium text-gray-900">
              {data.from_name} &lt;{data.from_email}&gt;
            </span>
          </div>
          <div className="flex">
            <span className="w-24 text-gray-500">Recipients:</span>
            <span className="font-medium text-gray-900">
              {estimatedRecipients.toLocaleString()} contacts
            </span>
          </div>
          <div className="flex">
            <span className="w-24 text-gray-500">Subject:</span>
            <span className="font-medium text-gray-900">{data.subject || 'No subject'}</span>
          </div>
        </div>
      </div>

      {/* Email Preview */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-700">Email Preview</h3>
          <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
            <button
              onClick={() => setPreviewDevice('desktop')}
              className={`p-1.5 rounded ${
                previewDevice === 'desktop' ? 'bg-white shadow text-blue-600' : 'text-gray-500'
              }`}
            >
              <Monitor className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPreviewDevice('mobile')}
              className={`p-1.5 rounded ${
                previewDevice === 'mobile' ? 'bg-white shadow text-blue-600' : 'text-gray-500'
              }`}
            >
              <Smartphone className="w-4 h-4" />
            </button>
          </div>
        </div>
        <CampaignPreview
          subject={data.subject}
          content={data.content_html}
          device={previewDevice}
        />
      </div>

      {/* Send Test Email */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Send Test Email</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTestModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            <Send className="w-4 h-4" />
            Send Test
          </button>
          <span className="text-sm text-gray-500">
            Send a test email to verify everything looks correct
          </span>
        </div>
      </div>

      {/* Schedule Options */}
      <SendScheduler
        scheduleType={data.schedule_type}
        scheduledAt={data.scheduled_at}
        optimalTime={data.optimal_time}
        onChange={onChange}
        error={errors.scheduled_at}
      />

      {/* Pre-send Checklist */}
      <PreSendChecklist checklist={checklist} />

      {/* Test Send Modal */}
      {showTestModal && (
        <TestSendModal
          campaignData={data}
          onClose={() => setShowTestModal(false)}
        />
      )}
    </div>
  );
};

export default StepReview;
