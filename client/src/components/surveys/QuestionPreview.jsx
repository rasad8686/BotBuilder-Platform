import React from 'react';
import NPSQuestion from './question-types/NPSQuestion';
import RatingQuestion from './question-types/RatingQuestion';
import EmojiQuestion from './question-types/EmojiQuestion';
import ScaleQuestion from './question-types/ScaleQuestion';
import SingleChoiceQuestion from './question-types/SingleChoiceQuestion';
import MultipleChoiceQuestion from './question-types/MultipleChoiceQuestion';
import TextQuestion from './question-types/TextQuestion';

const QuestionPreview = ({ question, value, onChange, readonly = true }) => {
  const renderQuestion = () => {
    switch (question.type) {
      case 'nps':
        return (
          <NPSQuestion
            value={value}
            onChange={onChange}
            readonly={readonly}
          />
        );

      case 'rating':
        return (
          <RatingQuestion
            maxRating={question.max_rating || 5}
            value={value}
            onChange={onChange}
            readonly={readonly}
          />
        );

      case 'emoji':
        return (
          <EmojiQuestion
            value={value}
            onChange={onChange}
            readonly={readonly}
          />
        );

      case 'scale':
        return (
          <ScaleQuestion
            min={question.min || 1}
            max={question.max || 10}
            minLabel={question.min_label}
            maxLabel={question.max_label}
            value={value}
            onChange={onChange}
            readonly={readonly}
          />
        );

      case 'single_choice':
        return (
          <SingleChoiceQuestion
            options={question.options || []}
            value={value}
            onChange={onChange}
            readonly={readonly}
          />
        );

      case 'multiple_choice':
        return (
          <MultipleChoiceQuestion
            options={question.options || []}
            value={value}
            onChange={onChange}
            readonly={readonly}
          />
        );

      case 'text':
        return (
          <TextQuestion
            placeholder={question.placeholder}
            multiline={question.multiline}
            value={value}
            onChange={onChange}
            readonly={readonly}
          />
        );

      default:
        return (
          <p className="text-gray-500 text-sm">Unknown question type: {question.type}</p>
        );
    }
  };

  return (
    <div>
      <p className="font-medium text-gray-900 mb-1">
        {question.title || 'Untitled Question'}
        {question.required && <span className="text-red-500 ml-1">*</span>}
      </p>
      {question.description && (
        <p className="text-sm text-gray-500 mb-3">{question.description}</p>
      )}
      {renderQuestion()}
    </div>
  );
};

export default QuestionPreview;
