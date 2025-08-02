import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Profiles from './components/Profiles';
import Tools from './components/Tools';
import Activity from './components/Activity';
import Settings from './components/Settings/Settings';
import UpdateNotification from './components/UpdateNotification';
import { AppProvider } from './context/AppContext';
import { initMessageBox } from './utils/messageBox';
import './i18n';
import './assets/css/global.css';
import './assets/css/app.css';

// 平台检测工具函数
const checkIsMacOS = () => {
  if (window.electron && window.electron.platform) {
    return window.electron.platform === 'darwin';
  }
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /macintosh|mac os x/i.test(userAgent);
};

const App = () => {
  // 添加活动项状态
  const [activeItem, setActiveItem] = useState('dashboard');
  // 添加配置文件数量状态
  const [profilesCount, setProfilesCount] = useState(0);
  const [isMacOS, setIsMacOS] = useState(checkIsMacOS());
  // 添加更新通知状态
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);
  // 添加系统设置状态
  const [appSettings, setAppSettings] = useState({ checkUpdateOnBoot: true });
  
  useEffect(() => {
    initMessageBox();
  }, []);
  
  // 加载系统设置并检查更新
  useEffect(() => {
    const loadSettingsAndCheckUpdates = async () => {
      try {
        // 加载系统设置
        if (window.electron && window.electron.getSettings) {
          const result = await window.electron.getSettings();
          if (result.success) {
            setAppSettings(result.settings);
            
            // 如果设置为启动时检查更新，则执行检查
            if (result.settings.checkUpdateOnBoot) {
              checkForUpdates();
            }
          }
        } else {
          // 如果无法获取设置，默认检查更新
          checkForUpdates();
        }
      } catch (error) {
        console.error('加载设置或检查更新失败:', error);
      }
    };
    
    loadSettingsAndCheckUpdates();
  }, []);
  
  // 检查更新
  const checkForUpdates = async () => {
    if (window.electron && window.electron.checkForUpdates) {
      try {
        const result = await window.electron.checkForUpdates();
        if (result && result.success && result.hasUpdate) {
          // 检查是否跳过此版本
          try {
            const skipVersion = localStorage.getItem('skipVersion');
            if (skipVersion === result.latestVersion) {
              console.log('用户已选择跳过此版本:', skipVersion);
              return;
            }
          } catch (error) {
            console.error('读取跳过版本信息失败:', error);
          }
          
          setShowUpdateNotification(true);
        }
      } catch (error) {
        console.error('检查更新失败:', error);
      }
    }
  };

  // 获取配置文件数量
  useEffect(() => {
    let isMounted = true;
    
    const getProfilesCount = async () => {
          if (window.electron && window.electron.profiles && window.electron.profiles.getFiles) {
      try {
        const result = await window.electron.profiles.getFiles();
          if (!isMounted) return;
          
          if (result && result.success && Array.isArray(result.files)) {
            setProfilesCount(result.files.length);
          } else {
            // 配置文件数据格式不正确
            setProfilesCount(0);
          }
        } catch (error) {
          if (!isMounted) return;
          console.error('获取配置文件数量失败:', error); // 添加错误日志
          setProfilesCount(0);
        }
      }
    };

    getProfilesCount();

    // 添加事件监听器以更新配置文件数量
    const updateProfilesCount = () => {
      if (isMounted) getProfilesCount();
    };

    if (window.electron && window.electron.profiles && window.electron.profiles.onChanged) {
      window.electron.profiles.onChanged(updateProfilesCount);
    }

    return () => {
      isMounted = false;
      if (window.electron && window.electron.offProfilesChanged) {
        window.electron.offProfilesChanged(updateProfilesCount);
      }
    };
  }, []); // 空依赖数组表示只执行一次

  // 处理侧边栏菜单点击
  const handleItemClick = (item) => {
    setActiveItem(item);
  };

  // 处理切换到Activity视图
  const handleSwitchToActivity = () => {
    setActiveItem('activity');
  };

  // 处理切换到Settings视图
  const handleSwitchToSettings = (section = 'basic') => {
    setActiveItem('settings');
    if (section === 'core') {
      // 可以通过事件或状态管理来通知Settings组件跳转到core部分
      setTimeout(() => {
        // 发送自定义事件来通知Settings组件切换到core部分
        window.dispatchEvent(new CustomEvent('switchToSettingsSection', { detail: { section } }));
      }, 100);
    }
  };

  // 窗口控制工具函数
  const handleWindowAction = (action) => {
    if (window.electron) {
      try {
        switch(action) {
          case 'minimize':
            window.electron.window.minimize();
            break;
          case 'maximize':
            window.electron.window.maximize();
            break;
          case 'close':
            window.electron.window.close();
            break;
        }
      } catch (error) {
        console.error(`窗口${action}操作失败:`, error);
      }
    } else {
      try {
        const { remote } = window.require('electron');
        if (remote) {
          const currentWindow = remote.getCurrentWindow();
          switch(action) {
            case 'minimize':
              currentWindow.minimize();
              break;
            case 'maximize':
              if (currentWindow.isMaximized()) {
                currentWindow.unmaximize();
              } else {
                currentWindow.maximize();
              }
              break;
            case 'close':
              currentWindow.close();
              break;
          }
        }
      } catch (error) {
        console.error(`窗口${action}操作失败:`, error);
      }
    }
  };

  // 处理窗口控制按钮的点击事件
  const handleMinimize = () => handleWindowAction('minimize');
  const handleMaximize = () => handleWindowAction('maximize');
  const handleClose = () => handleWindowAction('close');

  const isSettingsActive = activeItem === 'settings';

  return (
    <AppProvider>
      <Router basename="/">
        <Routes>
          <Route path="/" element={
            <div className={`app-container ${isMacOS ? 'mac-os' : ''} ${isSettingsActive ? 'settings-active' : ''}`}>
              {/* 添加可拖动区域 */}
              <div className="window-draggable-area"></div>
              
              {/* 添加窗口控制按钮，在 macOS 环境下不显示 */}
              {!isMacOS && (
                <div className="window-controls">
                  <button className="control-button minimize" onClick={handleMinimize} title="最小化">—</button>
                  <button className="control-button maximize" onClick={handleMaximize} title="最大化">□</button>
                  <button className="control-button close" onClick={handleClose} title="关闭">×</button>
                </div>
              )}
              
              {/* 顶部控制区域 */}
              <div className="top-controls">
                {/* 顶部为空，只用于拖动和控制按钮 */}
              </div>

              {/* 横线 */}
              <div className="horizontal-line"></div>
              
              {/* 内容区域 */}
              <div className="content-container">
                <Sidebar
                  activeItem={activeItem}
                  onItemClick={handleItemClick}
                  profilesCount={profilesCount}
                  isMinimized={false}
                />
                <div className="main-content" style={{ position: 'relative' }}>
                  {activeItem === 'dashboard' && (
                    <Dashboard activeView={activeItem} onSwitchToActivity={handleSwitchToActivity} onSwitchToSettings={handleSwitchToSettings} />
                  )}
                  {activeItem === 'profiles' && (
                    <div className="view-container">
                      <Profiles />
                    </div>
                  )}
                  {activeItem === 'tools' && (
                    <div className="view-container">
                      <Tools />
                    </div>
                  )}
                  {activeItem === 'activity' && (
                    <div className="view-container">
                      <Activity isActivityView={true} />
                    </div>
                  )}
                  {activeItem === 'settings' && (
                    <div className="view-container">
                      <Settings />
                    </div>
                  )}
                </div>
              </div>

              {/* 添加更新通知组件 */}
              {showUpdateNotification && (
                <UpdateNotification onClose={() => setShowUpdateNotification(false)} />
              )}
            </div>
          } />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Router>
    </AppProvider>
  );
};

export default App;
