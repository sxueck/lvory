import React, { useState, useEffect } from 'react';
import '../assets/css/systemindicator.css';

const SystemStatus = () => {
  // 添加系统状态
  const [systemStats, setSystemStats] = useState({
    startTime: new Date().toLocaleString(),
    coreVersion: 'N/A',
    activeConnections: 0,
    memoryUsage: '0MB'
  });
  const [profileData, setProfileData] = useState([]);
  const [isDownloadingCore, setIsDownloadingCore] = useState(false);
  const [coreDownloadProgress, setCoreDownloadProgress] = useState(0);
  const [coreDownloadError, setCoreDownloadError] = useState('');
  const [coreDownloadSuccess, setCoreDownloadSuccess] = useState(false);

  // 获取系统状态和配置文件数据
  useEffect(() => {
    // 监听配置文件数据
    const handleProfileData = (event, data) => {
      setProfileData(data || []);
    };

    // 获取sing-box版本
    const fetchCoreVersion = async () => {
      if (window.electron && window.electron.singbox && window.electron.singbox.getVersion) {
        try {
          const result = await window.electron.singbox.getVersion();
          if (result.success) {
            setSystemStats(prev => ({
              ...prev,
              coreVersion: result.version || 'unknown'
            }));
          }
        } catch (error) {
          console.error('获取版本失败:', error);
        }
      }
    };

    if (window.electron) {
      window.electron.onProfileData(handleProfileData);
      
      // 手动请求配置文件数据
      window.electron.getProfileData().then((data) => {
        if (data && data.length > 0) {
          setProfileData(data);
        }
      }).catch(err => {
        console.error('获取配置文件数据失败:', err);
      });
    }

    fetchCoreVersion();

    // 组件卸载时移除事件监听
    return () => {
      if (window.electron && window.electron.removeProfileData) {
        window.electron.removeProfileData(handleProfileData);
      }
    };
  }, []);

  // 处理内核下载
  const handleCoreDownload = () => {
    if (window.electron && window.electron.singbox && window.electron.singbox.downloadCore) {
      setIsDownloadingCore(true);
      setCoreDownloadError('');
      setCoreDownloadSuccess(false);
      
      window.electron.singbox.downloadCore()
        .then(result => {
          setIsDownloadingCore(false);
          if (result.success) {
            setCoreDownloadSuccess(true);
            // 更新版本信息
            window.electron.singbox.getVersion().then(versionResult => {
              if (versionResult.success) {
                setSystemStats(prev => ({
                  ...prev,
                  coreVersion: versionResult.version || 'unknown'
                }));
              }
            });
          } else {
            setCoreDownloadError(result.error || '下载失败');
          }
        })
        .catch(error => {
          setIsDownloadingCore(false);
          setCoreDownloadError(error.message || '下载过程中出错');
        });
    }
  };

  // 监听内核下载进度
  useEffect(() => {
    if (window.electron && window.electron.onCoreDownloadProgress) {
      const removeListener = window.electron.onCoreDownloadProgress(progress => {
        setCoreDownloadProgress(progress.progress);
      });
      
      return () => {
        if (removeListener) removeListener();
      };
    }
  }, []);

  return (
    <div className="system-status-card">
      <h3>系统状态</h3>
      
      <div className="status-item">
        <div className="status-label">程序启动时间</div>
        <div className="status-value">{systemStats.startTime}</div>
      </div>
      
      <div className="status-item">
        <div className="status-label">内核版本</div>
        <div className="status-value-row">
          <div className="status-value">
            {systemStats.coreVersion === 'N/A' ? (
              <span>未安装</span>
            ) : (
              systemStats.coreVersion
            )}
          </div>
          {systemStats.coreVersion === 'N/A' && !isDownloadingCore && (
            <button 
              onClick={handleCoreDownload}
              className="download-core-btn"
            >
              下载内核
            </button>
          )}
          {isDownloadingCore && (
            <div className="download-progress">
              <div className="progress-text">{coreDownloadProgress}%</div>
              <div className="progress-bar" style={{width: `${coreDownloadProgress}%`}}></div>
            </div>
          )}
        </div>
        {coreDownloadError && (
          <div className="download-error">{coreDownloadError}</div>
        )}
        {coreDownloadSuccess && (
          <div className="download-success">下载成功</div>
        )}
      </div>
      
      <div className="status-item">
        <div className="status-label">总节点数</div>
        <div className="status-value">{profileData.length} 个</div>
      </div>
    </div>
  );
};

export default SystemStatus; 