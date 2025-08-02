import React, { useState, useEffect, useCallback } from 'react';
import '../../assets/css/dashboard.css';
import Activity from '../Activity';

import ProfileModal from './ProfileModal';
import ControlPanel from './ControlPanel';
import NodeList from './NodeList';
import StatsOverview from './StatsOverview';

import useSpeedTest from './SpeedTest';
import useCoreManagement from './CoreManagement';
import useSingBoxControl from './SingBoxControl';
import useStatusMonitor from './StatusMonitor';
import useProfileUpdate from './hooks/useProfileUpdate';
import usePrivacySettings from '../../hooks/usePrivacySettings';
import { debouncedCall } from '../../utils/ipcOptimizer';

const Dashboard = ({ activeView = 'dashboard', onSwitchToActivity, onSwitchToSettings }) => {
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [profileData, setProfileData] = useState([]);
  const [nodeTypeStats, setNodeTypeStats] = useState({ ss: 0, vm: 0, tr: 0, dir: 0, other: 0 });
  const [privateMode, setPrivateMode] = useState(false);

  // 使用优化的隐私设置 hook
  const { privacySettings, setPrivacySettings } = usePrivacySettings();
  
  // 添加扩展视图状态
  const [isExpandedView, setIsExpandedView] = useState(false);
  
  // 添加API地址设置
  const [apiAddress, setApiAddress] = useState('127.0.0.1:9090');
  
  const [systemStats, setSystemStats] = useState({
    startTime: new Date().toLocaleString(),
    coreVersion: 'N/A',
    activeConnections: 0,
    memoryUsage: '0MB'
  });

  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' or 'activity'
  const { isTesting, testResults, loadingStates, setTestResults, handleSpeedTest } = useSpeedTest(profileData, apiAddress);
  
  const coreManagement = useCoreManagement()
  const singBoxControl = useSingBoxControl();
  const { 
    isRunning, 
    isStarting, 
    isStopping, 
    isRestarting, 
    toggleSingBox, 
    restartSingBox,
    coreExists,
    isDownloadingCore,
    downloadProgress,
    downloadMessage
  } = singBoxControl;
  
  const { handleDownloadSuccess } = useProfileUpdate(setProfileData);
  
  // 监听状态变化
  useStatusMonitor(
    singBoxControl, 
    setSystemStats, 
    setProfileData, 
    setNodeTypeStats, 
    setTestResults
  );

  // 获取API地址设置
  useEffect(() => {
          if (window.electron && window.electron.settings && window.electron.settings.get) {
        window.electron.settings.get().then(result => {
        if (result && result.success) {
          setApiAddress(result.settings.apiAddress || '127.0.0.1:9090');
        }
      }).catch(err => {
        console.error('获取API地址设置失败:', err);
      });
    }
  }, []);

  const calculateNodeStats = useCallback((profiles) => {
    if (!profiles || profiles.length === 0) {
      return { ss: 0, vm: 0, tr: 0, dir: 0, other: 0 };
    }

    const stats = { ss: 0, vm: 0, tr: 0, dir: 0, other: 0 };

    profiles.forEach(node => {
      const type = node.type ? node.type.toLowerCase() : '';

      if (type.includes('shadowsocks')) {
        stats.ss++;
      } else if (type.includes('vmess')) {
        stats.vm++;
      } else if (type.includes('trojan')) {
        stats.tr++;
      } else if (type.includes('direct')) {
        stats.dir++;
      } else {
        stats.other++;
      }
    });

    return stats;
  }, []);

  const updateProfileData = useCallback(async () => {
    if (!window.electron) return;

    debouncedCall('updateProfileData', async () => {
      try {
        const data = await window.electron.profiles.getData();
        if (data && data.success && Array.isArray(data.profiles)) {
          setProfileData(data.profiles);
          setNodeTypeStats(calculateNodeStats(data.profiles));
        }
      } catch (err) {
        console.error('更新配置文件数据失败:', err);
      }
    }, 200);
  }, [calculateNodeStats]);

  useEffect(() => {
    if (activeView === 'dashboard') {
      updateProfileData();
    }

    const unsubscribers = [];

    if (window.electron) {
      if (window.electron.onConfigChanged) {
        unsubscribers.push(window.electron.onConfigChanged(updateProfileData));
      }
      if (window.electron.onDashboardRefresh) {
        unsubscribers.push(window.electron.onDashboardRefresh(updateProfileData));
      }
      if (window.electron.profiles && window.electron.profiles.onChanged) {
        unsubscribers.push(window.electron.profiles.onChanged(updateProfileData));
      }
    }

    const updateInterval = setInterval(() => {
      if (activeView === 'dashboard') {
        updateProfileData();
      }
    }, 30000);

    return () => {
      clearInterval(updateInterval);
      unsubscribers.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
    };
  }, [activeView, updateProfileData]);

  const togglePrivateMode = () => {
    setPrivateMode(!privateMode);
  };

  // 处理隐私设置变更 - 现在由 hook 自动处理持久化
  const handlePrivacySettingsChange = setPrivacySettings;

  // 添加切换扩展视图的函数
  const toggleExpandedView = () => {
    setIsExpandedView(!isExpandedView);
  };

  return (
    <div className="dashboard" style={{ display: activeView === 'dashboard' || activeView === 'activity' ? 'block' : 'none' }}>
      <div className="dashboard-content" style={{ 
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Dashboard视图内容 */}
        <div style={{ 
          display: activeView === 'dashboard' ? 'flex' : 'none',
          flexDirection: 'column',
          height: '100%'
        }}>
          {/* 只有在非扩展视图时显示状态概览 */}
          {!isExpandedView && (
            <div className="stats-overview" style={{
              maxHeight: 'calc(100vh / 3)',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              gap: '0px',
              flexShrink: 0 // 防止被压缩
            }}>
              <ControlPanel
                isRunning={isRunning}
                onTogglePrivate={togglePrivateMode}
                onSpeedTest={handleSpeedTest}
                onToggleSingBox={toggleSingBox}
                privateMode={privateMode}
                isTesting={isTesting}
                isStarting={isStarting}
                isStopping={isStopping}
                isRestarting={isRestarting}
                onOpenProfileModal={() => setIsModalOpen(true)}
                onRestartSingBox={restartSingBox}
                coreExists={coreExists}
                isDownloadingCore={isDownloadingCore}
                downloadProgress={downloadProgress}
                downloadMessage={downloadMessage}
                onSwitchToActivity={onSwitchToActivity}
                onSwitchToSettings={onSwitchToSettings}
                privacySettings={privacySettings}
                onPrivacySettingsChange={handlePrivacySettingsChange}
                style={{ padding: '5px 0' }}
              />
              
              <div style={{ 
                flex: 1,
                width: '100%',
                overflow: 'hidden',
                marginTop: '-5px',
                backgroundColor: 'transparent',
                minHeight: '160px'
              }}>
                <StatsOverview
                  apiAddress={apiAddress}
                  privacySettings={privacySettings}
                />
              </div>

              <ProfileModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onDownloadSuccess={handleDownloadSuccess}
              />
            </div>
          )}

          <div className="node-list-container" style={{
            flex: 1,
            overflow: 'hidden', // 外层容器不滚动
            position: 'relative',
            minHeight: 0 // 确保flex子元素可以正确收缩
          }}>
            <NodeList
              profileData={profileData}
              testResults={testResults}
              loadingStates={loadingStates}
              privateMode={privateMode}
              privacySettings={privacySettings}
              isExpandedView={isExpandedView}
              onToggleExpandedView={toggleExpandedView}
            />
          </div>
        </div>

        {/* Activity视图内容 */}
        <div className="activity-view" style={{ 
          width: '100%', 
          padding: '0',
          display: activeView === 'activity' ? 'block' : 'none',
          height: '100%'
        }}>
          <Activity isKernelRunning={isRunning} isActivityView={activeView === 'activity'} />
        </div>
      </div>

      {/* 添加CSS动画 */}
      <style>
        {`
          @keyframes loading-shimmer {
            0% {
              transform: translateX(-100%);
            }
            100% {
              transform: translateX(100%);
            }
          }

          .spinning {
            animation: spin 1.5s linear infinite;
          }
          
          .lightning-spinning {
            animation: lightning-flash 1.2s ease-in-out infinite;
          }
          
          @keyframes spin {
            0% {
              transform: rotate(0deg);
            }
            100% {
              transform: rotate(360deg);
            }
          }
          
          @keyframes lightning-flash {
            0%, 100% { 
              opacity: 1;
              transform: scale(1);
            }
            50% { 
              opacity: 0.6;
              transform: scale(1.1);
            }
          }
          
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .activity-view {
            height: 100%;
            padding: 20px;
            overflow: auto;
          }
          
          .modal-content {
            max-height: 80vh;
            overflow-y: auto;
          }
          
          .success-state .modal-content {
            background-color: #f8fafc;
          }
          
          .success-state .close-button {
            display: block !important;
            opacity: 1 !important;
            pointer-events: auto !important;
          }
          
          .node-list-container {
            transition: height 0.3s ease;
          }
        `}
      </style>
    </div>
  );
};

export default Dashboard;