import React, { useState, useEffect, useRef } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Profiles from './components/Profiles';
import Tools from './components/Tools';
import Activity from './components/Activity';
import Settings from './components/Settings/Settings';
import UpdateNotification from './components/UpdateNotification';
import { AppProvider, useAppContext } from './context/AppContext';
import { initMessageBox } from './utils/messageBox';
import './i18n'; // 引入i18n初始化文件
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
  // 添加窗口可见性状态
  const [isWindowVisible, setIsWindowVisible] = useState(true);
  // 用于存储动画帧请求ID集合
  const animationFrameRefs = useRef(new Set());
  // 用于存储非必要的定时器
  const timersRef = useRef({});
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
  
  // 监听窗口可见性变化事件
  useEffect(() => {
    if (window.electron && window.electron.window && window.electron.window.onVisibilityChange) {
      let isMounted = true;
      const handleVisibilityChange = (state) => {
        if (!isMounted) return;
        setIsWindowVisible(state.isVisible);
        
        if (state.isVisible) {
          // 窗口显示时，恢复正常渲染
          resumeRendering();
        } else {
          // 窗口隐藏时，暂停不必要的渲染
          pauseRendering();
        }
      };
      
      // 注册事件监听
      const unsubscribe = window.electron.window.onVisibilityChange(handleVisibilityChange);
      
      return () => {
        isMounted = false;
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      };
    }
  }, []); // 空依赖数组表示只执行一次

  const pauseRendering = () => {
    // 取消所有不必要的requestAnimationFrame
    animationFrameRefs.current.forEach(id => {
      window.cancelAnimationFrame(id);
    });
    animationFrameRefs.current.clear();

    // 暂停所有不必要的定时器
    Object.values(timersRef.current).forEach(timer => {
      if (timer) {
        clearInterval(timer);
      }
    });
    
    // 调整渲染更新频率
    if (document.body) {
      document.body.classList.add('background-throttled');
    }
  };

  // 恢复正常渲染和计算
  const resumeRendering = () => {
    // 恢复必要的UI更新
    if (document.body) {
      document.body.classList.remove('background-throttled');
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
            console.error('获取配置文件数据格式不正确:', result);
            setProfilesCount(0);
          }
        } catch (error) {
          if (!isMounted) return;
          console.error('获取配置文件数量失败:', error);
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
            <div className={`app-container ${isMacOS ? 'mac-os' : ''} ${isSettingsActive ? 'settings-active' : ''} ${!isWindowVisible ? 'window-hidden' : ''}`}>
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
                  isMinimized={isSettingsActive}
                />
                <div className="main-content" style={{ position: 'relative' }}>
                  {activeItem === 'dashboard' && (
                    <Dashboard activeView={activeItem} onSwitchToActivity={handleSwitchToActivity} />
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
