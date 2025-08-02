import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getAboutInfo } from '../../utils/version';

const SingBoxCoreManager = ({ isVisible, onClose }) => {
  const { t } = useTranslation();
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentVersion, setCurrentVersion] = useState('');
  const [installedVersions, setInstalledVersions] = useState([]);
  const [downloadingVersions, setDownloadingVersions] = useState(new Set());
  const [switchingVersion, setSwitchingVersion] = useState(null);
  const [showWarning, setShowWarning] = useState(false);
  const [pendingSwitchVersion, setPendingSwitchVersion] = useState(null);
  const [aboutInfo, setAboutInfo] = useState({ CORE_VERSION: '-' });


  useEffect(() => {
    if (isVisible) {
      loadReleases();
      loadAboutInfo();
      loadInstalledVersions();
    }
  }, [isVisible]);

  const loadAboutInfo = async () => {
    try {
      const info = await getAboutInfo();
      setAboutInfo(info);
      setCurrentVersion(info.CORE_VERSION || '-');
    } catch (error) {
      console.error('获取关于信息失败:', error);
    }
  };

  const loadInstalledVersions = async () => {
    try {
      if (window.electron && window.electron.coreManager && window.electron.coreManager.getInstalledVersions) {
        const result = await window.electron.coreManager.getInstalledVersions();
        if (result.success) {
          setInstalledVersions(result.versions);
        }
      }
    } catch (error) {
      console.error('获取已安装版本失败:', error);
    }
  };

  const loadReleases = async () => {
    setLoading(true);
    setError(null);
    
    try {
      if (window.electron && window.electron.coreManager && window.electron.coreManager.getSingBoxReleases) {
        const result = await window.electron.coreManager.getSingBoxReleases();
        if (result.success) {
          setReleases(result.releases);
        } else {
          setError(result.error || '获取版本信息失败');
        }
      } else {
        setError('API不可用');
      }
    } catch (error) {
      console.error('加载版本信息失败:', error);
      setError(error.message || '网络请求失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (version) => {
    setDownloadingVersions(prev => new Set([...prev, version]));
    
    try {
      if (window.electron && window.electron.coreManager && window.electron.coreManager.downloadVersion) {
        const result = await window.electron.coreManager.downloadVersion(version);
        if (result.success) {
          await loadInstalledVersions();
        } else {
          setError(`下载失败: ${result.error}`);
        }
      }
    } catch (error) {
      console.error('下载版本失败:', error);
      setError(`下载失败: ${error.message}`);
    } finally {
      setDownloadingVersions(prev => {
        const newSet = new Set(prev);
        newSet.delete(version);
        return newSet;
      });
    }
  };

  const handleSwitchVersion = async (version) => {
    setSwitchingVersion(version);

    try {
      if (window.electron && window.electron.coreManager && window.electron.coreManager.switchVersion) {
        const result = await window.electron.coreManager.switchVersion(version);
        if (result.success) {
          setCurrentVersion(version);
          await loadAboutInfo();

          // 切换成功后显示兼容性警告
          setPendingSwitchVersion(version);
          setShowWarning(true);
        } else {
          setError(`切换失败: ${result.error}`);
        }
      }
    } catch (error) {
      console.error('切换版本失败:', error);
      setError(`切换失败: ${error.message}`);
    } finally {
      setSwitchingVersion(null);
    }
  };

  const confirmSwitchVersion = async () => {
    // 这个函数现在只是关闭警告对话框
    setShowWarning(false);
    setPendingSwitchVersion(null);
  };

  const handleDeleteVersion = async (version) => {
    if (version === currentVersion) {
      setError('无法删除当前使用的版本');
      return;
    }

    const confirmed = window.confirm(t('settings.confirmDeleteVersion', { version }));
    if (!confirmed) return;

    try {
      if (window.electron && window.electron.coreManager && window.electron.coreManager.deleteVersion) {
        const result = await window.electron.coreManager.deleteVersion(version);
        if (result.success) {
          await loadInstalledVersions();
        } else {
          setError(`删除失败: ${result.error}`);
        }
      }
    } catch (error) {
      console.error('删除版本失败:', error);
      setError(`删除失败: ${error.message}`);
    }
  };



  const isVersionInstalled = (version) => {
    return installedVersions.includes(version);
  };

  const isVersionDownloading = (version) => {
    return downloadingVersions.has(version);
  };

  // 只显示前10个版本，简化列表
  const filteredReleases = releases.slice(0, 10);

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backdropFilter: 'blur(20px) brightness(1.1)',
      WebkitBackdropFilter: 'blur(20px) brightness(1.1)',
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10000,
      animation: 'fadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        width: '90%',
        maxWidth: '1000px',
        height: '80%',
        maxHeight: '800px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
        overflow: 'hidden',
        border: '1px solid #e2e8f0'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#ffffff'
        }}>
          <div>
            <h2 style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: '600',
              color: '#1e293b',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
            }}>
              {t('settings.coreManagement')}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              color: '#64748b',
              padding: '6px',
              borderRadius: '6px',
              transition: 'all 0.2s ease',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(100, 116, 139, 0.1)'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            ×
          </button>
        </div>

        {/* Current Version Info */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '14px', color: '#64748b', fontWeight: '500' }}>
                {t('settings.currentVersion')}:
              </span>
              <span style={{
                fontSize: '15px',
                fontWeight: '600',
                padding: '4px 12px',
                backgroundColor: '#10b981',
                color: 'white',
                borderRadius: '6px'
              }}>
                {currentVersion || t('settings.unknown')}
              </span>
            </div>
            <button
              onClick={loadReleases}
              disabled={loading}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#64748b',
                color: 'white',
                fontSize: '13px',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.target.style.backgroundColor = '#475569';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.target.style.backgroundColor = '#64748b';
                }
              }}
            >
              {loading ? t('settings.refreshing') : t('settings.refresh')}
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px 24px',
          backgroundColor: '#ffffff'
        }}>
          {/* Loading State */}
          {loading && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '200px',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                border: '3px solid #e2e8f0',
                borderTopColor: '#64748b',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              <span style={{ color: '#64748b', fontWeight: '500' }}>
                {t('settings.loadingVersions')}
              </span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div style={{
              padding: '24px',
              backgroundColor: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '12px',
              color: '#b91c1c',
              textAlign: 'center',
              marginBottom: '16px'
            }}>
              <p style={{ margin: 0, fontWeight: '600', fontSize: '16px' }}>
                {t('settings.loadFailed')}
              </p>
              <p style={{ margin: '8px 0 16px 0', fontSize: '14px', color: '#dc2626' }}>
                {error}
              </p>
              <button
                onClick={() => {
                  setError(null);
                  loadReleases();
                }}
                style={{
                  padding: '8px 20px',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease'
                }}
              >
                {t('settings.retry')}
              </button>
            </div>
          )}



          {/* Releases List */}
          {!loading && !error && filteredReleases.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredReleases.map(release => {
                const version = release.tag_name.replace(/^v/, '');
                const isInstalled = isVersionInstalled(version);
                const isDownloading = isVersionDownloading(version);
                const isCurrent = version === currentVersion;
                const isSwitching = switchingVersion === version;

                return (
                  <div
                    key={release.id}
                    style={{
                      border: isCurrent ? '2px solid #10b981' : '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '16px',
                      backgroundColor: isCurrent ? 'rgba(16, 185, 129, 0.05)' : '#ffffff',
                      transition: 'all 0.2s ease',
                      boxShadow: isCurrent ? '0 2px 8px rgba(16, 185, 129, 0.1)' : '0 1px 3px rgba(0, 0, 0, 0.05)'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          fontSize: '15px',
                          fontWeight: '600',
                          color: '#1e293b'
                        }}>
                          {release.name}
                        </span>
                        {isCurrent && (
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '5px',
                            fontSize: '12px',
                            fontWeight: '600',
                            backgroundColor: '#10b981',
                            color: 'white'
                          }}>
                            当前版本
                          </span>
                        )}
                        {isInstalled && !isCurrent && (
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '5px',
                            fontSize: '12px',
                            fontWeight: '500',
                            backgroundColor: '#64748b',
                            color: 'white'
                          }}>
                            已安装
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        {!isInstalled && (
                          <button
                            onClick={() => handleDownload(version)}
                            disabled={isDownloading}
                            style={{
                              padding: '6px 14px',
                              backgroundColor: isDownloading ? '#9ca3af' : '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '500',
                              cursor: isDownloading ? 'not-allowed' : 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              if (!isDownloading) {
                                e.target.style.backgroundColor = '#2563eb';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isDownloading) {
                                e.target.style.backgroundColor = '#3b82f6';
                              }
                            }}
                          >
                            {isDownloading ? '下载中...' : '下载'}
                          </button>
                        )}

                        {isInstalled && !isCurrent && (
                          <button
                            onClick={() => handleSwitchVersion(version)}
                            disabled={isSwitching}
                            style={{
                              padding: '6px 14px',
                              backgroundColor: isSwitching ? '#9ca3af' : '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '500',
                              cursor: isSwitching ? 'not-allowed' : 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              if (!isSwitching) {
                                e.target.style.backgroundColor = '#059669';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isSwitching) {
                                e.target.style.backgroundColor = '#10b981';
                              }
                            }}
                          >
                            {isSwitching ? '切换中...' : '切换'}
                          </button>
                        )}

                        {isInstalled && !isCurrent && (
                          <button
                            onClick={() => handleDeleteVersion(version)}
                            style={{
                              padding: '6px 14px',
                              backgroundColor: '#dc2626',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '500',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.backgroundColor = '#b91c1c';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.backgroundColor = '#dc2626';
                            }}
                          >
                            删除
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Warning Modal */}
      {showWarning && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10001,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '420px',
            width: '90%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{
              margin: '0 0 16px 0',
              fontSize: '18px',
              fontWeight: '600',
              color: '#f59e0b',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
            }}>
              内核版本切换提醒
            </h3>
            <p style={{
              margin: '0 0 24px 0',
              fontSize: '14px',
              color: '#64748b',
              lineHeight: '1.5'
            }}>
              内核版本已成功切换！请注意，不同版本的内核可能存在兼容性差异，如遇到问题请及时切换回原版本。
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={confirmSwitchVersion}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#059669';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#10b981';
                }}
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SingBoxCoreManager;
