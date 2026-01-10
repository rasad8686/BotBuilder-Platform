import React from 'react';

const TextQuestion = ({
  placeholder = 'Enter your answer...',
  multiline = true,
  value = '',
  onChange,
  readonly = false
}) => {
  const handleChange = (e) => {
    if (!readonly && onChange) {
      onChange(e.target.value);
    }
  };

  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={readonly}
        rows={4}
        className={`w-full px-4 py-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
          readonly ? 'bg-gray-50 text-gray-500' : ''
        }`}
      />
    );
  }

  return (
    <input
      type="text"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={readonly}
      className={`w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
        readonly ? 'bg-gray-50 text-gray-500' : ''
      }`}
    />
  );
};

export default TextQuestion;
