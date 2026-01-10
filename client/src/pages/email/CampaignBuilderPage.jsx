import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Save,
  Send,
  Clock,
  X,
  AlertCircle,
  Mail,
  Users,
  FileText,
  Eye
} from 'lucide-react';
import {
  useCampaignQuery,
  useCreateCampaignMutation,
  useUpdateCampaignMutation,
  useSendCampaignMutation,
  useScheduleCampaignMutation
} from '../../hooks/email/useCampaigns';
import StepSetup from '../../components/email/campaigns/StepSetup';
import StepRecipients from '../../components/email/campaigns/StepRecipients';
import StepContent from '../../components/email/campaigns/StepContent';
import StepReview from '../../components/email/campaigns/StepReview';

const STEPS = [
  { id: 'setup', label: 'Setup', icon: Mail, description: 'Campaign name & sender' },
  { id: 'recipients', label: 'Recipients', icon: Users, description: 'Select audience' },
  { id: 'content', label: 'Content', icon: FileText, description: 'Email template' },
  { id: 'review', label: 'Review & Send', icon: Eye, description: 'Final check' }
];

const CampaignBuilderPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;

  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    type: 'broadcast',
    from_name: '',
    from_email: '',
    reply_to: '',
    list_ids: [],
    exclude_list_ids: [],
    send_to: 'lists', // all, lists, segment
    segment_rules: [],
    subject: '',
    preview_text: '',
    template_id: null,
    content_html: '',
    content_json: {},
    use_template: true,
    schedule_type: 'now', // now, later
    scheduled_at: null,
    optimal_time: false,
    settings: {
      trackOpens: true,
      trackClicks: true,
      unsubscribeLink: true
    }
  });
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const { data: campaignData, isLoading: loadingCampaign } = useCampaignQuery(id);
  const createMutation = useCreateCampaignMutation();
  const updateMutation = useUpdateCampaignMutation();
  const sendMutation = useSendCampaignMutation();
  const scheduleMutation = useScheduleCampaignMutation();

  useEffect(() => {
    if (campaignData && isEditing) {
      setFormData({
        name: campaignData.name || '',
        type: campaignData.type || 'broadcast',
        from_name: campaignData.from_name || '',
        from_email: campaignData.from_email || '',
        reply_to: campaignData.reply_to || '',
        list_ids: campaignData.list_ids || [],
        exclude_list_ids: campaignData.exclude_list_ids || [],
        send_to: campaignData.list_ids?.length > 0 ? 'lists' : 'all',
        segment_rules: campaignData.segment_rules || [],
        subject: campaignData.subject || '',
        preview_text: campaignData.preview_text || '',
        template_id: campaignData.template_id || null,
        content_html: campaignData.content_html || '',
        content_json: campaignData.content_json || {},
        use_template: !!campaignData.template_id,
        schedule_type: campaignData.scheduled_at ? 'later' : 'now',
        scheduled_at: campaignData.scheduled_at || null,
        optimal_time: false,
        settings: campaignData.settings || {
          trackOpens: true,
          trackClicks: true,
          unsubscribeLink: true
        }
      });
    }
  }, [campaignData, isEditing]);

  const updateFormData = (updates) => {
    setFormData(prev => ({ ...prev, ...updates }));
    // Clear related errors
    const clearedErrors = { ...errors };
    Object.keys(updates).forEach(key => delete clearedErrors[key]);
    setErrors(clearedErrors);
  };

  const validateStep = (step) => {
    const newErrors = {};

    switch (step) {
      case 0: // Setup
        if (!formData.name.trim()) newErrors.name = 'Campaign name is required';
        if (!formData.from_name.trim()) newErrors.from_name = 'Sender name is required';
        if (!formData.from_email.trim()) newErrors.from_email = 'Sender email is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.from_email)) {
          newErrors.from_email = 'Invalid email format';
        }
        break;

      case 1: // Recipients
        if (formData.send_to === 'lists' && formData.list_ids.length === 0) {
          newErrors.list_ids = 'Select at least one list';
        }
        break;

      case 2: // Content
        if (!formData.subject.trim()) newErrors.subject = 'Subject line is required';
        if (formData.use_template && !formData.template_id) {
          newErrors.template_id = 'Select a template';
        }
        if (!formData.use_template && !formData.content_html.trim()) {
          newErrors.content_html = 'Email content is required';
        }
        break;

      case 3: // Review
        if (formData.schedule_type === 'later' && !formData.scheduled_at) {
          newErrors.scheduled_at = 'Schedule date is required';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        status: 'draft'
      };

      if (isEditing) {
        await updateMutation.mutateAsync({ id, data: payload });
      } else {
        const result = await createMutation.mutateAsync(payload);
        navigate(`/email/campaigns/${result.id}`, { replace: true });
      }
    } catch (error) {
      console.error('Failed to save draft:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSend = async () => {
    if (!validateStep(3)) return;

    try {
      let campaignId = id;

      // Save first if needed
      if (!isEditing) {
        const result = await createMutation.mutateAsync({
          ...formData,
          status: 'draft'
        });
        campaignId = result.id;
      } else {
        await updateMutation.mutateAsync({ id, data: formData });
      }

      // Send or schedule
      if (formData.schedule_type === 'later') {
        await scheduleMutation.mutateAsync({
          id: campaignId,
          scheduled_at: formData.scheduled_at
        });
      } else {
        await sendMutation.mutateAsync(campaignId);
      }

      navigate('/email/campaigns');
    } catch (error) {
      console.error('Failed to send campaign:', error);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <StepSetup
            data={formData}
            errors={errors}
            onChange={updateFormData}
          />
        );
      case 1:
        return (
          <StepRecipients
            data={formData}
            errors={errors}
            onChange={updateFormData}
          />
        );
      case 2:
        return (
          <StepContent
            data={formData}
            errors={errors}
            onChange={updateFormData}
          />
        );
      case 3:
        return (
          <StepReview
            data={formData}
            errors={errors}
            onChange={updateFormData}
            onSend={handleSend}
          />
        );
      default:
        return null;
    }
  };

  if (loadingCampaign && isEditing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/email/campaigns')}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  {isEditing ? 'Edit Campaign' : 'Create Campaign'}
                </h1>
                <p className="text-sm text-gray-500">{formData.name || 'Untitled Campaign'}</p>
              </div>
            </div>
            <button
              onClick={handleSaveDraft}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Draft'}
            </button>
          </div>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;

              return (
                <React.Fragment key={step.id}>
                  <button
                    onClick={() => index < currentStep && setCurrentStep(index)}
                    disabled={index > currentStep}
                    className={`flex items-center gap-3 ${
                      index <= currentStep ? 'cursor-pointer' : 'cursor-not-allowed'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                        isCompleted
                          ? 'bg-green-500 text-white'
                          : isActive
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                    </div>
                    <div className="text-left hidden sm:block">
                      <p className={`text-sm font-medium ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                        {step.label}
                      </p>
                      <p className="text-xs text-gray-400">{step.description}</p>
                    </div>
                  </button>

                  {index < STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-4 ${
                        index < currentStep ? 'bg-green-500' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          {renderStepContent()}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              currentStep === 0
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/email/campaigns')}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>

            {currentStep < STEPS.length - 1 ? (
              <button
                onClick={handleNext}
                className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Next Step
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveDraft}
                  className="px-4 py-2 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Save Draft
                </button>
                {formData.schedule_type === 'later' ? (
                  <button
                    onClick={handleSend}
                    className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Clock className="w-4 h-4" />
                    Schedule Campaign
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    className="inline-flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Send className="w-4 h-4" />
                    Send Now
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignBuilderPage;
