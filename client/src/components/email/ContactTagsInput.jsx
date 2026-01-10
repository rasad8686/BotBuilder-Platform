import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Plus } from 'lucide-react';
import { useTagsQuery } from '../../hooks/email/useContactTags';

const ContactTagsInput = ({
  tags = [],
  onChange,
  editable = false,
  placeholder
}) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Fetch existing tags for autocomplete
  const { data: tagsData } = useTagsQuery();
  const existingTags = tagsData?.tags || [];

  // Filter suggestions
  const suggestions = existingTags.filter(tag =>
    tag.toLowerCase().includes(inputValue.toLowerCase()) &&
    !tags.includes(tag)
  ).slice(0, 5);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Add tag
  const addTag = (tag) => {
    const trimmedTag = tag.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      onChange([...tags, trimmedTag]);
    }
    setInputValue('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  // Remove tag
  const removeTag = (tagToRemove) => {
    onChange(tags.filter(tag => tag !== tagToRemove));
  };

  // Handle key press
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  if (!editable) {
    return (
      <div className="flex flex-wrap gap-2">
        {tags.length > 0 ? (
          tags.map((tag, i) => (
            <span
              key={i}
              className="px-2 py-1 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 text-sm rounded-full"
            >
              {tag}
            </span>
          ))
        ) : (
          <span className="text-sm text-gray-400 dark:text-gray-500">
            {t('email.tags.noTags', 'No tags')}
          </span>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-wrap gap-2 p-2 min-h-[42px] border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
        {/* Existing tags */}
        {tags.map((tag, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-sm rounded-full"
          >
            {tag}
            <button
              onClick={() => removeTag(tag)}
              className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? (placeholder || t('email.tags.addTag', 'Add tag...')) : ''}
          className="flex-1 min-w-[100px] bg-transparent border-none outline-none text-gray-900 dark:text-white text-sm placeholder-gray-400"
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && (inputValue || suggestions.length > 0) && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg max-h-40 overflow-y-auto">
          {inputValue && !tags.includes(inputValue.trim().toLowerCase()) && (
            <button
              onClick={() => addTag(inputValue)}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
            >
              <Plus className="w-4 h-4" />
              {t('email.tags.create', 'Create "{{tag}}"', { tag: inputValue.trim() })}
            </button>
          )}
          {suggestions.map((tag, i) => (
            <button
              key={i}
              onClick={() => addTag(tag)}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300"
            >
              {tag}
            </button>
          ))}
          {inputValue && suggestions.length === 0 && tags.includes(inputValue.trim().toLowerCase()) && (
            <p className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
              {t('email.tags.alreadyAdded', 'Tag already added')}
            </p>
          )}
        </div>
      )}

      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {t('email.tags.hint', 'Press Enter or comma to add a tag')}
      </p>
    </div>
  );
};

export default ContactTagsInput;
