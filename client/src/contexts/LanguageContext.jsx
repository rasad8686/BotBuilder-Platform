import { createContext, useContext, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const { i18n } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState(
    localStorage.getItem('language') || 'en'
  );

  useEffect(() => {
    i18n.changeLanguage(currentLanguage);
  }, [currentLanguage, i18n]);

  const changeLanguage = (lang) => {
    setCurrentLanguage(lang);
    localStorage.setItem('language', lang);
    i18n.changeLanguage(lang);
  };

  const languages = [
    { code: 'en', name: 'English', flag: 'EN', isText: true },
    { code: 'tr', name: 'Türkçe', flag: '🇹🇷', isText: false },
    { code: 'az', name: 'Azərbaycan', flag: '🇦🇿', isText: false },
    { code: 'ru', name: 'Русский', flag: '🇷🇺', isText: false }
  ];

  return (
    <LanguageContext.Provider
      value={{
        currentLanguage,
        changeLanguage,
        languages
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};
