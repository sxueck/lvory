/**
 * 通用内核控制组件
 * 支持多种内核类型的统一控制接口
 */

import { useState, useEffect } from 'react';
import { showMessage } from '../../utils/messageBox';

const useCoreControl = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [coreExists, setCoreExists] = useState(false);
  const [isDownloadingCore, setIsDownloadingCore] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadMessage, setDownloadMessage] = useState('');
  const [currentCoreType, setCurrentCoreType] = useState('');
  const [coreConfig, setCoreConfig] = useState(null);

  // 检查内核是否存在
  const checkCoreExists = async () => {
    if (window.electron && window.electron.core && window.electron.core.checkInstalled) {
      try {
        const result = await window.electron.core.checkInstalled();
        const isInstalled = result && result.success ? result.installed : false;
        setCoreExists(isInstalled);
        return isInstalled;
      } catch (err) {
        console.error('检查内核是否存在失败:', err);
        setCoreExists(false);
        return false;
      }
    } else {
      setCoreExists(false);
      return false;
    }
  };

  // 获取当前内核类型
  const getCurrentCoreType = async () => {
    if (window.electron && window.electron.core && window.electron.core.getCurrentType) {
      try {
        const result = await window.electron.core.getCurrentType();
        if (result && result.success) {
          setCurrentCoreType(result.coreType);
          return result.coreType;
        }
      } catch (err) {
        console.error('获取当前内核类型失败:', err);
      }
    }
    return '';
  };

  // 获取内核配置信息
  const getCoreConfig = async () => {
    if (window.electron && window.electron.core && window.electron.core.getConfigInfo) {
      try {
        const result = await window.electron.core.getConfigInfo();
        if (result && result.success) {
          setCoreConfig(result.config);
          return result.config;
        }
      } catch (err) {
        console.error('获取内核配置信息失败:', err);
      }
    }
    return null;
  };

  // 监听下载进度
  useEffect(() => {
    const handleDownloadProgress = (progress) => {
      setDownloadProgress(progress.progress);
      setDownloadMessage(progress.message || '');
      
      if (progress.progress === 100) {
        setTimeout(() => {
          setIsDownloadingCore(false);
          checkCoreExists();
        }, 1000);
      } else if (progress.progress === -1) {
        setIsDownloadingCore(false);
        showMessage('下载失败: ' + (progress.message || '未知错误'));
      }
    };

    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.on('core-download-progress', handleDownloadProgress);
      
      return () => {
        window.electron.ipcRenderer.removeListener('core-download-progress', handleDownloadProgress);
      };
    }
  }, []);

  // 监听内核状态更新
  useEffect(() => {
    const handleStatusUpdate = (status) => {
      setIsRunning(status.isRunning);
    };

    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.on('core-status-update', handleStatusUpdate);
      
      return () => {
        window.electron.ipcRenderer.removeListener('core-status-update', handleStatusUpdate);
      };
    }
  }, []);

  // 初始化检查
  useEffect(() => {
    checkCoreExists();
    getCurrentCoreType();
    getCoreConfig();
  }, []);

  // 启动内核
  const startCore = async () => {
    if (window.electron && window.electron.core) {
      if (!isRunning) {
        setIsStarting(true);
        
        try {
          // 获取配置文件路径
          let configPath = null;
          if (window.electron.getConfigPath) {
            configPath = await window.electron.getConfigPath();
          }
          
          // 启动内核
          const result = await window.electron.core.start({ configPath });
          
          setIsStarting(false);
          if (result && result.success) {
            setIsRunning(true);
            console.log(`${currentCoreType} 内核启动成功`);
          } else {
            console.error(`启动 ${currentCoreType} 内核失败:`, result ? result.error : '未知错误');
            showMessage(`启动失败: ${result && result.error ? result.error : '未知错误'}`);
          }
        } catch (error) {
          setIsStarting(false);
          console.error(`启动 ${currentCoreType} 内核异常:`, error);
          showMessage(`启动异常: ${error.message}`);
        }
      }
    }
  };

  // 停止内核
  const stopCore = async () => {
    if (window.electron && window.electron.core) {
      if (isRunning) {
        setIsStopping(true);
        
        try {
          const result = await window.electron.core.stop();
          
          setIsStopping(false);
          if (result && result.success) {
            setIsRunning(false);
            console.log(`${currentCoreType} 内核停止成功`);
          } else {
            console.error(`停止 ${currentCoreType} 内核失败:`, result ? result.error : '未知错误');
            showMessage(`停止失败: ${result && result.error ? result.error : '未知错误'}`);
          }
        } catch (error) {
          setIsStopping(false);
          console.error(`停止 ${currentCoreType} 内核异常:`, error);
          showMessage(`停止异常: ${error.message}`);
        }
      }
    }
  };

  // 重启内核
  const restartCore = async () => {
    if (window.electron && window.electron.core) {
      setIsRestarting(true);
      
      try {
        // 先停止
        if (isRunning) {
          const stopResult = await window.electron.core.stop();
          if (!stopResult || !stopResult.success) {
            throw new Error(stopResult ? stopResult.error : '停止失败');
          }
          setIsRunning(false);
        }
        
        // 等待一下
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 再启动
        let configPath = null;
        if (window.electron.getConfigPath) {
          configPath = await window.electron.getConfigPath();
        }
        
        const startResult = await window.electron.core.start({ configPath });
        
        setIsRestarting(false);
        if (startResult && startResult.success) {
          setIsRunning(true);
          console.log(`${currentCoreType} 内核重启成功`);
          showMessage(`${currentCoreType} 内核重启成功`);
        } else {
          console.error(`重启 ${currentCoreType} 内核失败:`, startResult ? startResult.error : '未知错误');
          showMessage(`重启失败: ${startResult && startResult.error ? startResult.error : '未知错误'}`);
        }
      } catch (error) {
        setIsRestarting(false);
        console.error(`重启 ${currentCoreType} 内核异常:`, error);
        showMessage(`重启异常: ${error.message}`);
      }
    }
  };

  // 下载内核
  const downloadCore = async () => {
    if (window.electron && window.electron.core) {
      setIsDownloadingCore(true);
      setDownloadProgress(0);
      setDownloadMessage('准备下载...');
      
      try {
        const result = await window.electron.core.download();
        
        if (result && result.success) {
          setDownloadProgress(100);
          setDownloadMessage('下载完成');
          setTimeout(() => {
            setIsDownloadingCore(false);
            checkCoreExists();
          }, 1000);
          showMessage(`${currentCoreType} 内核下载成功`);
        } else {
          setIsDownloadingCore(false);
          const errorMsg = result && result.error ? result.error : '下载失败';
          showMessage(`下载失败: ${errorMsg}`);
        }
      } catch (error) {
        setIsDownloadingCore(false);
        console.error(`下载 ${currentCoreType} 内核异常:`, error);
        showMessage(`下载异常: ${error.message}`);
      }
    }
  };

  // 获取内核状态
  const getStatus = async () => {
    if (window.electron && window.electron.core && window.electron.core.getStatus) {
      try {
        const result = await window.electron.core.getStatus();
        if (result && result.success) {
          setIsRunning(result.isRunning);
          return result;
        }
      } catch (error) {
        console.error('获取内核状态失败:', error);
      }
    }
    return null;
  };

  return {
    // 状态
    isRunning,
    isStarting,
    isStopping,
    isRestarting,
    coreExists,
    isDownloadingCore,
    downloadProgress,
    downloadMessage,
    currentCoreType,
    coreConfig,
    
    // 方法
    startCore,
    stopCore,
    restartCore,
    downloadCore,
    checkCoreExists,
    getCurrentCoreType,
    getCoreConfig,
    getStatus
  };
};

export default useCoreControl;
