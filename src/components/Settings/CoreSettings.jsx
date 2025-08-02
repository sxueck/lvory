/**
 * 内核设置组件
 * 提供内核类型选择和相关配置
 */

// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { showMessage } from '../../utils/messageBox';

const CoreSettings = () => {
  const [coreTypes, setCoreTypes] = useState([]);
  const [currentCoreType, setCurrentCoreType] = useState('');
  const [coreConfig, setCoreConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  // 加载支持的内核类型
  useEffect(() => {
    loadSupportedCoreTypes();
    loadCurrentCoreType();
    loadCoreConfig();
  }, []);

  const loadSupportedCoreTypes = async () => {
    try {
      if (window.electron && window.electron.core) {
        const result = await window.electron.core.getSupportedTypes();
        if (result.success) {
          setCoreTypes(result.coreTypes);
        }
      }
    } catch (error) {
      console.error('加载支持的内核类型失败:', error);
    }
  };

  const loadCurrentCoreType = async () => {
    try {
      if (window.electron && window.electron.core) {
        const result = await window.electron.core.getCurrentType();
        if (result.success) {
          setCurrentCoreType(result.coreType);
        }
      }
    } catch (error) {
      console.error('加载当前内核类型失败:', error);
    }
  };

  const loadCoreConfig = async () => {
    try {
      if (window.electron && window.electron.core) {
        const result = await window.electron.core.getConfigInfo();
        if (result.success) {
          setCoreConfig(result.config);
        }
      }
    } catch (error) {
      console.error('加载内核配置信息失败:', error);
    }
  };

  const handleCoreTypeChange = async (newCoreType) => {
    if (newCoreType === currentCoreType) {
      return;
    }

    setIsSwitching(true);
    try {
      if (window.electron && window.electron.core) {
        const result = await window.electron.core.switchType(newCoreType);
        if (result.success) {
          setCurrentCoreType(newCoreType);
          await loadCoreConfig(); // 重新加载配置信息
          showMessage(`成功切换到 ${newCoreType} 内核`, 'success');
        } else {
          showMessage(`切换内核失败: ${result.error}`, 'error');
        }
      }
    } catch (error) {
      console.error('切换内核类型失败:', error);
      showMessage(`切换内核失败: ${error.message}`, 'error');
    } finally {
      setIsSwitching(false);
    }
  };

  const checkCoreInstallation = async () => {
    setIsLoading(true);
    try {
      if (window.electron && window.electron.core) {
        const result = await window.electron.core.checkInstalled();
        if (result.success) {
          if (result.installed) {
            showMessage(`${currentCoreType} 内核已安装 (版本: ${result.version || '未知'})`, 'success');
          } else {
            showMessage(`${currentCoreType} 内核未安装`, 'warning');
          }
        } else {
          showMessage(`检查安装状态失败: ${result.error}`, 'error');
        }
      }
    } catch (error) {
      console.error('检查内核安装状态失败:', error);
      showMessage(`检查安装状态失败: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadCore = async (version = null) => {
    setIsLoading(true);
    try {
      if (window.electron && window.electron.coreManager) {
        const result = await window.electron.coreManager.downloadCore(currentCoreType, version);
        if (result.success) {
          showMessage(`${currentCoreType} 内核下载成功 (版本: ${result.version})`, 'success');
          await checkCoreInstallation(); // 重新检查安装状态
        } else {
          showMessage(`内核下载失败: ${result.error}`, 'error');
        }
      }
    } catch (error) {
      console.error('下载内核失败:', error);
      showMessage(`下载内核失败: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="core-settings">
      <div className="settings-section">
        <h3 className="section-title">内核设置</h3>
        
        {/* 内核类型选择 */}
        <div className="setting-item">
          <label className="setting-label">
            内核类型
            <span className="setting-description">
              选择要使用的代理内核类型
            </span>
          </label>
          <div className="setting-control">
            <select 
              value={currentCoreType} 
              onChange={(e) => handleCoreTypeChange(e.target.value)}
              disabled={isSwitching}
              className="setting-select"
            >
              {coreTypes.map(coreType => (
                <option key={coreType.value} value={coreType.value}>
                  {coreType.label}
                </option>
              ))}
            </select>
            {isSwitching && <span className="loading-indicator">切换中...</span>}
          </div>
        </div>

        {/* 当前内核信息 - 简化版 */}
        {coreConfig && (
          <div className="setting-item">
            <label className="setting-label">当前内核信息</label>
            <div className="core-info-simple">
              <div className="info-row">
                <span className="info-label">名称:</span>
                <span className="info-value">{coreConfig.displayName}</span>
              </div>
              <div className="info-row">
                <span className="info-label">配置格式:</span>
                <span className="info-value">{coreConfig.configFormat.toUpperCase()}</span>
              </div>
            </div>
          </div>
        )}

        {/* 内核管理操作 */}
        <div className="setting-item">
          <label className="setting-label">内核管理</label>
          <div className="setting-actions">
            <button 
              onClick={checkCoreInstallation}
              disabled={isLoading}
              className="btn btn-secondary"
            >
              {isLoading ? '检查中...' : '检查安装状态'}
            </button>
            <button 
              onClick={downloadCore}
              disabled={isLoading}
              className="btn btn-primary"
            >
              {isLoading ? '下载中...' : '下载内核'}
            </button>
          </div>
        </div>

        {/* 注意事项 - 简化版 */}
        <div className="setting-item">
          <div className="setting-notice">
            <p>切换内核类型会停止当前运行的内核，不同内核使用不同的配置格式。</p>
          </div>
        </div>
      </div>

      <style>{`
        .core-settings {
          padding: 24px;
          max-width: 800px;
          margin: 0 auto;
        }

        .settings-section {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }

        .section-title {
          margin: 0 0 24px 0;
          color: #1e293b;
          font-size: 20px;
          font-weight: 600;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .setting-item {
          margin-bottom: 24px;
          padding-bottom: 24px;
          border-bottom: 1px solid #f1f5f9;
        }

        .setting-item:last-child {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }

        .setting-label {
          display: block;
          margin-bottom: 12px;
          color: #1e293b;
          font-weight: 600;
          font-size: 15px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .setting-description {
          display: block;
          font-size: 12px;
          color: var(--text-secondary);
          font-weight: normal;
          margin-top: 4px;
        }

        .setting-control {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .setting-select {
          padding: 10px 14px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #ffffff;
          color: #1e293b;
          min-width: 220px;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .setting-select:focus {
          outline: none;
          border-color: #64748b;
          box-shadow: 0 0 0 3px rgba(100, 116, 139, 0.1);
        }

        .loading-indicator {
          color: var(--text-secondary);
          font-size: 12px;
        }

        .core-info-simple {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 20px;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          padding: 8px 0;
        }

        .info-row:last-child {
          margin-bottom: 0;
        }

        .info-label {
          color: #64748b;
          font-weight: 500;
          font-size: 14px;
        }

        .info-value {
          color: #1e293b;
          font-weight: 600;
          font-size: 14px;
        }



        .setting-actions {
          display: flex;
          gap: 12px;
        }

        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s ease;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-primary {
          background: #64748b;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #475569;
        }

        .btn-secondary {
          background: #f8fafc;
          color: #64748b;
          border: 1px solid #e2e8f0;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #f1f5f9;
        }

        .setting-notice {
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 18px;
        }

        .setting-notice p {
          margin: 0;
          color: #64748b;
          font-size: 14px;
          line-height: 1.6;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
};

export default CoreSettings;
