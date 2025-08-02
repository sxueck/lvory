import React, { useState, useEffect } from 'react';
import SettingsSidebar from './SettingsSidebar';
import SettingsContent from './SettingsContent';

const Settings = () => {
  const [selectedSection, setSelectedSection] = useState('basic');


  useEffect(() => {
    const handleSwitchToSection = (event) => {
      const { section } = event.detail;
      if (section) {
        setSelectedSection(section);
      }
    };

    window.addEventListener('switchToSettingsSection', handleSwitchToSection);

    return () => {
      window.removeEventListener('switchToSettingsSection', handleSwitchToSection);
    };
  }, []);

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <SettingsSidebar
        selectedSection={selectedSection}
        onSectionChange={setSelectedSection}
      />
      <SettingsContent section={selectedSection} />
    </div>
  );
};

export default Settings; 