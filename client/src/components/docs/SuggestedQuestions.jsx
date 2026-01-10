import { useState } from 'react';

const suggestedQuestions = {
  az: [
    { text: "Bot nece yaradilir?", icon: "+" },
    { text: "Telegram inteqrasiyasi nece qurulur?", icon: "@" },
    { text: "API key haradan alinir?", icon: "#" },
    { text: "Webhook nedir?", icon: "?" }
  ],
  tr: [
    { text: "Bot nasil olusturulur?", icon: "+" },
    { text: "Telegram entegrasyonu nasil kurulur?", icon: "@" },
    { text: "API key nereden alinir?", icon: "#" },
    { text: "Webhook nedir?", icon: "?" }
  ],
  en: [
    { text: "How to create a bot?", icon: "+" },
    { text: "How to setup Telegram integration?", icon: "@" },
    { text: "Where to get API key?", icon: "#" },
    { text: "What is a webhook?", icon: "?" }
  ],
  ru: [
    { text: "Kak sozdat bota?", icon: "+" },
    { text: "Kak nastroit integraciyu s Telegram?", icon: "@" },
    { text: "Gde poluchit API klyuch?", icon: "#" },
    { text: "Chto takoe webhook?", icon: "?" }
  ]
};

export default function SuggestedQuestions({ language = 'en', onSelect, disabled = false }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const questions = suggestedQuestions[language] || suggestedQuestions.en;

  return (
    <div className="suggested-questions">
      <p
        className="text-xs mb-2"
        style={{ color: '#8898aa' }}
      >
        {language === 'az' ? 'Teklifler:' :
         language === 'tr' ? 'Oneriler:' :
         language === 'ru' ? 'Predlozheniya:' : 'Suggestions:'}
      </p>
      <div className="flex flex-wrap gap-2">
        {questions.map((question, index) => (
          <button
            key={index}
            onClick={() => !disabled && onSelect(question.text)}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            disabled={disabled}
            className="px-3 py-2 text-sm rounded-lg transition-all duration-200 flex items-center gap-2"
            style={{
              backgroundColor: hoveredIndex === index ? '#635bff' : '#f6f9fc',
              color: hoveredIndex === index ? '#fff' : '#32325d',
              border: '1px solid',
              borderColor: hoveredIndex === index ? '#635bff' : '#e6ebf1',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.6 : 1
            }}
          >
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
              style={{
                backgroundColor: hoveredIndex === index ? 'rgba(255,255,255,0.2)' : '#e6ebf1',
                color: hoveredIndex === index ? '#fff' : '#635bff'
              }}
            >
              {question.icon}
            </span>
            {question.text}
          </button>
        ))}
      </div>
    </div>
  );
}

export { suggestedQuestions };
