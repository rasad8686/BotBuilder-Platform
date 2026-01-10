import React from 'react';
import NPSWidget from './NPSWidget';
import RatingWidget from './RatingWidget';
import EmojiRatingWidget from './EmojiRatingWidget';
import ScaleWidget from './ScaleWidget';
import ChoiceWidget from './ChoiceWidget';
import TextInputWidget from './TextInputWidget';

export default function SurveyRenderer({
  question,
  value,
  comment,
  onChange,
  primaryColor = '#8b5cf6'
}) {
  if (!question) return null;

  const handleValueChange = (newValue) => {
    onChange(newValue, { comment });
  };

  const handleCommentChange = (newComment) => {
    onChange(value, { comment: newComment });
  };

  const renderQuestion = () => {
    const commonProps = {
      value,
      onChange: handleValueChange,
      primaryColor,
      config: question.config || {}
    };

    switch (question.type) {
      case 'nps':
        return <NPSWidget {...commonProps} />;

      case 'rating':
      case 'stars':
        return <RatingWidget {...commonProps} maxRating={question.config?.maxRating || 5} />;

      case 'emoji':
      case 'emoji_rating':
        return <EmojiRatingWidget {...commonProps} />;

      case 'scale':
      case 'slider':
        return (
          <ScaleWidget
            {...commonProps}
            min={question.config?.min || 1}
            max={question.config?.max || 10}
            minLabel={question.config?.minLabel}
            maxLabel={question.config?.maxLabel}
          />
        );

      case 'single_choice':
      case 'radio':
        return (
          <ChoiceWidget
            {...commonProps}
            options={question.options || []}
            multiple={false}
          />
        );

      case 'multiple_choice':
      case 'checkbox':
        return (
          <ChoiceWidget
            {...commonProps}
            options={question.options || []}
            multiple={true}
          />
        );

      case 'text':
      case 'open_ended':
      case 'textarea':
        return (
          <TextInputWidget
            {...commonProps}
            placeholder={question.config?.placeholder || 'Cavabinizi yazin...'}
            multiline={question.type === 'textarea' || question.config?.multiline}
          />
        );

      default:
        return (
          <div style={{ color: '#6b7280', fontSize: '14px' }}>
            Namelum sual novu: {question.type}
          </div>
        );
    }
  };

  return (
    <div style={{ animation: 'surveyFadeIn 0.2s ease' }}>
      {/* Question Text */}
      <div
        style={{
          fontSize: '16px',
          fontWeight: '500',
          color: '#1f2937',
          marginBottom: '16px',
          lineHeight: '1.5'
        }}
      >
        {question.text}
        {question.required && (
          <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>
        )}
      </div>

      {/* Question Description */}
      {question.description && (
        <div
          style={{
            fontSize: '13px',
            color: '#6b7280',
            marginBottom: '16px',
            lineHeight: '1.4'
          }}
        >
          {question.description}
        </div>
      )}

      {/* Question Input */}
      {renderQuestion()}

      {/* Optional Comment Field */}
      {question.allow_comment && (
        <div style={{ marginTop: '16px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              color: '#6b7280',
              marginBottom: '6px'
            }}
          >
            {question.comment_label || 'Serhiniz (istege bagli):'}
          </label>
          <textarea
            value={comment || ''}
            onChange={(e) => handleCommentChange(e.target.value)}
            placeholder="Elave fikrinizi yazin..."
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '14px',
              resize: 'vertical',
              minHeight: '60px',
              outline: 'none',
              boxSizing: 'border-box',
              fontFamily: 'inherit'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = primaryColor;
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#e5e7eb';
            }}
          />
        </div>
      )}
    </div>
  );
}
