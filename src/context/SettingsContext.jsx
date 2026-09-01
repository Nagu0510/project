import React, { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext(null);

export const SettingsProvider = ({ children }) => {
  const [showPreviousQuestionInsights, setShowPreviousQuestionInsights] = useState(() => {
    try {
      const saved = localStorage.getItem('skillsense_pq_insights');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [soundEffects, setSoundEffects] = useState(true);
  const [autoSaveCode, setAutoSaveCode] = useState(true);

  useEffect(() => {
    try {
      localStorage.setItem('skillsense_pq_insights', JSON.stringify(showPreviousQuestionInsights));
    } catch (e) {
      console.warn("Error saving settings", e);
    }
  }, [showPreviousQuestionInsights]);

  const togglePreviousQuestionInsights = () => {
    setShowPreviousQuestionInsights((prev) => !prev);
  };

  return (
    <SettingsContext.Provider
      value={{
        showPreviousQuestionInsights,
        setShowPreviousQuestionInsights,
        togglePreviousQuestionInsights,
        soundEffects,
        setSoundEffects,
        autoSaveCode,
        setAutoSaveCode,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
