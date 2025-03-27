import React, { createContext, useState, useContext, useEffect } from 'react';

const AppContext = createContext();

export const useAppContext = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
  const [state, setState] = useState({
    privateMode: false,
    theme: 'light',
    showAnimations: true,
  });

  // 加载持久化的设置
  useEffect(() => {
    const loadSettings = async () => {
      if (window.electron && window.electron.getSettings) {
        try {
          const result = await window.electron.getSettings();
          if (result && result.success && result.settings) {
            setState(prev => ({
              ...prev,
              ...result.settings,
              showAnimations: result.settings.showAnimations !== undefined 
                ? result.settings.showAnimations 
                : true,
            }));
          }
        } catch (error) {
          console.error('加载设置失败:', error);
        }
      }
    };

    loadSettings();
  }, []);

  const updateSettings = async (newSettings) => {
    setState(prev => ({
      ...prev,
      ...newSettings
    }));

    // 持久化设置
    if (window.electron && window.electron.saveSettings) {
      try {
        await window.electron.saveSettings({
          ...state,
          ...newSettings
        });
      } catch (error) {
        console.error('保存设置失败:', error);
      }
    }
  };

  return (
    <AppContext.Provider value={{ 
      ...state,
      updateSettings
    }}>
      {children}
    </AppContext.Provider>
  );
};

export default AppContext; 