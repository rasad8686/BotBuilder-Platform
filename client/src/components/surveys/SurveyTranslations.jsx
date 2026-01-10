import React, { useState } from 'react';
import {
  Globe,
  Plus,
  Trash2,
  Languages,
  Check,
  AlertCircle,
  Copy,
  ChevronDown,
  ChevronRight,
  Edit3,
  Eye,
  Wand2,
  RefreshCw
} from 'lucide-react';

const SurveyTranslations = ({ questions = [], translations = {}, onChange, readonly = false }) => {
  const [activeLanguage, setActiveLanguage] = useState('');
  const [expandedQuestions, setExpandedQuestions] = useState([]);
  const [showAddLanguage, setShowAddLanguage] = useState(false);

  const defaultTranslations = {
    defaultLanguage: 'en',
    languages: [],
    content: {},
    ...translations
  };

  const [localTranslations, setLocalTranslations] = useState(defaultTranslations);

  const availableLanguages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'az', name: 'Azerbaijani', flag: '🇦🇿' },
    { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
    { code: 'ru', name: 'Russian', flag: '🇷🇺' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'it', name: 'Italian', flag: '🇮🇹' },
    { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
    { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
    { code: 'pl', name: 'Polish', flag: '🇵🇱' },
    { code: 'uk', name: 'Ukrainian', flag: '🇺🇦' },
    { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
    { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
    { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
    { code: 'ko', name: 'Korean', flag: '🇰🇷' },
    { code: 'hi', name: 'Hindi', flag: '🇮🇳' }
  ];

  const updateTranslations = (field, value) => {
    if (readonly) return;
    const updated = { ...localTranslations, [field]: value };
    setLocalTranslations(updated);
    onChange?.(updated);
  };

  const addLanguage = (langCode) => {
    if (readonly) return;
    if (localTranslations.languages.includes(langCode)) return;

    const updated = {
      ...localTranslations,
      languages: [...localTranslations.languages, langCode],
      content: {
        ...localTranslations.content,
        [langCode]: {}
      }
    };
    setLocalTranslations(updated);
    onChange?.(updated);
    setActiveLanguage(langCode);
    setShowAddLanguage(false);
  };

  const removeLanguage = (langCode) => {
    if (readonly) return;
    const updated = {
      ...localTranslations,
      languages: localTranslations.languages.filter((l) => l !== langCode),
      content: Object.fromEntries(
        Object.entries(localTranslations.content).filter(([key]) => key !== langCode)
      )
    };
    setLocalTranslations(updated);
    onChange?.(updated);
    if (activeLanguage === langCode) {
      setActiveLanguage(updated.languages[0] || '');
    }
  };

  const updateTranslation = (langCode, questionId, field, value) => {
    if (readonly) return;
    const updated = {
      ...localTranslations,
      content: {
        ...localTranslations.content,
        [langCode]: {
          ...localTranslations.content[langCode],
          [questionId]: {
            ...(localTranslations.content[langCode]?.[questionId] || {}),
            [field]: value
          }
        }
      }
    };
    setLocalTranslations(updated);
    onChange?.(updated);
  };

  const toggleQuestion = (questionId) => {
    setExpandedQuestions((prev) =>
      prev.includes(questionId)
        ? prev.filter((id) => id !== questionId)
        : [...prev, questionId]
    );
  };

  const copyFromDefault = (langCode, questionId) => {
    if (readonly) return;
    const question = questions.find((q) => q.id === questionId);
    if (!question) return;

    updateTranslation(langCode, questionId, 'question', question.question || '');
    if (question.options) {
      updateTranslation(langCode, questionId, 'options', [...question.options]);
    }
  };

  const getTranslationProgress = (langCode) => {
    const content = localTranslations.content[langCode] || {};
    const total = questions.length;
    if (total === 0) return 100;

    const translated = questions.filter((q) => {
      const t = content[q.id];
      return t && t.question && t.question.trim().length > 0;
    }).length;

    return Math.round((translated / total) * 100);
  };

  const getLanguageInfo = (code) => {
    return availableLanguages.find((l) => l.code === code) || { code, name: code, flag: '🌐' };
  };

  const unusedLanguages = availableLanguages.filter(
    (l) => !localTranslations.languages.includes(l.code) && l.code !== localTranslations.defaultLanguage
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-cyan-50 to-teal-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
            <Globe className="w-5 h-5 text-cyan-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Translations</h3>
            <p className="text-sm text-gray-500">Manage survey translations for multiple languages</p>
          </div>
        </div>
      </div>

      {/* Language Tabs */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {/* Default Language */}
          <div className="flex-shrink-0 px-4 py-2 bg-cyan-100 text-cyan-700 rounded-lg text-sm font-medium flex items-center gap-2">
            <span>{getLanguageInfo(localTranslations.defaultLanguage).flag}</span>
            <span>{getLanguageInfo(localTranslations.defaultLanguage).name}</span>
            <span className="text-xs bg-cyan-200 px-2 py-0.5 rounded">Default</span>
          </div>

          {/* Added Languages */}
          {localTranslations.languages.map((langCode) => {
            const lang = getLanguageInfo(langCode);
            const progress = getTranslationProgress(langCode);
            const isActive = activeLanguage === langCode;

            return (
              <button
                key={langCode}
                onClick={() => setActiveLanguage(langCode)}
                className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                  isActive
                    ? 'bg-white border-2 border-cyan-500 text-cyan-700'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <span>{lang.flag}</span>
                <span>{lang.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  progress === 100 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {progress}%
                </span>
                {!readonly && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeLanguage(langCode);
                    }}
                    className="p-0.5 hover:bg-gray-100 rounded"
                  >
                    <Trash2 className="w-3 h-3 text-gray-400 hover:text-red-500" />
                  </button>
                )}
              </button>
            );
          })}

          {/* Add Language Button */}
          {!readonly && (
            <div className="relative">
              <button
                onClick={() => setShowAddLanguage(!showAddLanguage)}
                className="flex-shrink-0 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-cyan-400 hover:text-cyan-600 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Language
              </button>

              {showAddLanguage && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-10 max-h-64 overflow-y-auto">
                  {unusedLanguages.length === 0 ? (
                    <p className="p-4 text-sm text-gray-500 text-center">
                      All languages added
                    </p>
                  ) : (
                    unusedLanguages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => addLanguage(lang.code)}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3"
                      >
                        <span className="text-lg">{lang.flag}</span>
                        <span className="text-sm text-gray-700">{lang.name}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {localTranslations.languages.length === 0 ? (
          <div className="text-center py-12">
            <Languages className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h4 className="font-medium text-gray-900">No translations added</h4>
            <p className="text-sm text-gray-500 mt-1">
              Add languages to create translated versions of your survey
            </p>
          </div>
        ) : !activeLanguage ? (
          <div className="text-center py-12">
            <Globe className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h4 className="font-medium text-gray-900">Select a language</h4>
            <p className="text-sm text-gray-500 mt-1">
              Click on a language tab to start translating
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Language Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getLanguageInfo(activeLanguage).flag}</span>
                <div>
                  <h4 className="font-medium text-gray-900">
                    {getLanguageInfo(activeLanguage).name} Translation
                  </h4>
                  <p className="text-sm text-gray-500">
                    {getTranslationProgress(activeLanguage)}% complete
                  </p>
                </div>
              </div>
              {!readonly && (
                <button className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700">
                  <Wand2 className="w-4 h-4" />
                  Auto-translate
                </button>
              )}
            </div>

            {/* Progress Bar */}
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  getTranslationProgress(activeLanguage) === 100 ? 'bg-green-500' : 'bg-cyan-500'
                }`}
                style={{ width: `${getTranslationProgress(activeLanguage)}%` }}
              />
            </div>

            {/* Questions */}
            <div className="space-y-3 mt-6">
              {questions.map((question, index) => {
                const isExpanded = expandedQuestions.includes(question.id);
                const translation = localTranslations.content[activeLanguage]?.[question.id] || {};
                const isTranslated = translation.question && translation.question.trim().length > 0;

                return (
                  <div
                    key={question.id}
                    className="border border-gray-200 rounded-lg overflow-hidden"
                  >
                    {/* Question Header */}
                    <div
                      className="p-4 bg-gray-50 flex items-center justify-between cursor-pointer hover:bg-gray-100"
                      onClick={() => toggleQuestion(question.id)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 bg-cyan-100 text-cyan-600 rounded-lg flex items-center justify-center font-medium text-sm">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-medium text-gray-900 text-sm line-clamp-1">
                            {question.question || `Question ${index + 1}`}
                          </p>
                          <p className="text-xs text-gray-500 capitalize">{question.type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isTranslated ? (
                          <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                            <Check className="w-3 h-3" />
                            Translated
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                            <AlertCircle className="w-3 h-3" />
                            Pending
                          </span>
                        )}
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {/* Question Content */}
                    {isExpanded && (
                      <div className="p-4 space-y-4">
                        {/* Original */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-medium text-gray-500 uppercase">
                              Original ({getLanguageInfo(localTranslations.defaultLanguage).name})
                            </label>
                            {!readonly && (
                              <button
                                onClick={() => copyFromDefault(activeLanguage, question.id)}
                                className="text-xs text-cyan-600 hover:text-cyan-700 flex items-center gap-1"
                              >
                                <Copy className="w-3 h-3" />
                                Copy original
                              </button>
                            )}
                          </div>
                          <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
                            {question.question || 'No question text'}
                          </div>
                        </div>

                        {/* Translation */}
                        <div>
                          <label className="block text-xs font-medium text-gray-500 uppercase mb-2">
                            Translation ({getLanguageInfo(activeLanguage).name})
                          </label>
                          <textarea
                            value={translation.question || ''}
                            onChange={(e) => updateTranslation(activeLanguage, question.id, 'question', e.target.value)}
                            disabled={readonly}
                            rows={2}
                            placeholder={`Enter ${getLanguageInfo(activeLanguage).name} translation...`}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                          />
                        </div>

                        {/* Options Translation (for choice questions) */}
                        {question.options && question.options.length > 0 && (
                          <div>
                            <label className="block text-xs font-medium text-gray-500 uppercase mb-2">
                              Options
                            </label>
                            <div className="space-y-2">
                              {question.options.map((option, optIndex) => (
                                <div key={optIndex} className="grid grid-cols-2 gap-2">
                                  <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-600">
                                    {option}
                                  </div>
                                  <input
                                    type="text"
                                    value={translation.options?.[optIndex] || ''}
                                    onChange={(e) => {
                                      const newOptions = [...(translation.options || question.options.map(() => ''))];
                                      newOptions[optIndex] = e.target.value;
                                      updateTranslation(activeLanguage, question.id, 'options', newOptions);
                                    }}
                                    disabled={readonly}
                                    placeholder={`${getLanguageInfo(activeLanguage).name} translation...`}
                                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {questions.length === 0 && (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h4 className="font-medium text-gray-900">No questions to translate</h4>
                <p className="text-sm text-gray-500 mt-1">
                  Add questions to your survey first
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {activeLanguage && localTranslations.languages.length > 0 && (
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>{questions.length} questions total</span>
            <span>
              {Math.round((getTranslationProgress(activeLanguage) / 100) * questions.length)} translated
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Preview
            </button>
            <button className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700">
              Save Translations
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SurveyTranslations;
