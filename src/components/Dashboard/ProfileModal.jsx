import React, { useState } from 'react';
import Modal from '../Modal';
import { showMessage } from '../../utils/messageBox';

const ProfileModal = ({ isOpen, onClose, onDownloadSuccess }) => {
  const [url, setUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState(''); // 'success', 'error', 或 ''
  const [errorDetails, setErrorDetails] = useState('');
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [updateInterval, setUpdateInterval] = useState('0'); // '0'表示不自动更新
  const [isDefaultConfig, setIsDefaultConfig] = useState(false);

  // 重置所有交互状态
  const resetState = () => {
    setUrl('');
    setFileName('');
    setIsDownloading(false);
    setDownloadStatus('');
    setErrorDetails('');
    setShowErrorDetails(false);
    setUpdateInterval('0');
    setIsDefaultConfig(false);
  };

  // 处理关闭模态框
  const handleCloseModal = () => {
    // 当下载状态为成功时也允许关闭窗口
    if (!isDownloading || downloadStatus === 'success') {
      onClose();
      resetState();
    }
  };

  // 切换错误详情的显示状态
  const toggleErrorDetails = () => {
    setShowErrorDetails(!showErrorDetails);
  };

  // 处理下载配置文件
  const handleDownloadProfiles = () => {
    if (!url) {
      showMessage('Please enter a URL');
      return;
    }

    // 验证URL格式
    try {
      new URL(url); // 简单验证URL格式
    } catch (e) {
      setDownloadStatus('error');
      setErrorDetails('Invalid URL format. Please enter a valid URL, including http:// or https://');
      return;
    }
    
    setIsDownloading(true);
    setDownloadStatus('');
    setErrorDetails('');
    setShowErrorDetails(false);
    
    // 获取用户指定的文件名或使用从URL提取的文件名
    let customFileName = fileName.trim() || url.substring(url.lastIndexOf('/') + 1) || 'profile.config';
    
    // 如果设置为默认配置，则重命名为sing-box.json
    if (isDefaultConfig) {
      customFileName = 'sing-box.json';
    }
    
    // 调用Electron的IPC通信来下载文件
    if (window.electron) {
      window.electron.downloadProfile({
        url: url,
        fileName: customFileName,
        isDefaultConfig: isDefaultConfig
      })
        .then(result => {
          console.log('Download result:', result);
          if (result.success) {
            setDownloadStatus('success');
            setIsDownloading(false); // 确保下载状态被重置
            
            // 下载成功后回调
            if (onDownloadSuccess) {
              onDownloadSuccess(result);
            }
            
            // 3秒后关闭弹窗
            setTimeout(() => {
              onClose();
              resetState();
            }, 3000);
          } else {
            setDownloadStatus('error');
            setIsDownloading(false);
            setErrorDetails(result.message || result.error || 'Unknown error occurred');
          }
        })
        .catch(error => {
          console.error('Download failed:', error);
          setDownloadStatus('error');
          setIsDownloading(false);
          setErrorDetails(error.message || 'Unknown error occurred');
        });
    } else {
      try {
        // 尝试使用浏览器的fetch API下载
        fetch(url)
          .then(response => {
            if (!response.ok) {
              throw new Error(`Server responded with status: ${response.status}`);
            }
            return response.blob();
          })
          .then(blob => {
            // 创建下载链接
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = customFileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            setDownloadStatus('success');
            // 3秒后关闭弹窗
            setTimeout(() => {
              onClose();
              resetState();
            }, 3000);
          })
          .catch(error => {
            console.error('Download failed:', error);
            setDownloadStatus('error');
            setIsDownloading(false);
            setErrorDetails(error.message || 'Network request failed');
          });
      } catch (error) {
        console.error('Unable to download file:', error);
        setDownloadStatus('error');
        setIsDownloading(false);
        setErrorDetails(error.message || 'Browser download functionality not available');
      }
    }
  };

  // 渲染下载进度或状态UI
  const renderDownloadStatusUI = () => {
    if (isDownloading && !downloadStatus) {
      return (
        <div className="download-progress">
          <div className="progress-bar loading"></div>
          <p className="status-text">Downloading profile...</p>
        </div>
      );
    } else if (downloadStatus === 'success') {
      return (
        <div className="download-success">
          <div className="progress-bar success"></div>
          <p className="status-text success-text">Profile successfully downloaded!</p>
          {isDefaultConfig && (
            <p className="status-text success-text">已设置为默认配置文件 (sing-box.json)</p>
          )}
          {updateInterval !== '0' && (
            <p className="status-text update-schedule success-text">
              自动更新已设置为每 {updateInterval} 小时一次
            </p>
          )}
          <p className="status-text auto-close success-text">
            窗口将在3秒后自动关闭，或点击右上角关闭按钮关闭窗口
          </p>
        </div>
      );
    } else if (downloadStatus === 'error') {
      return (
        <div className="download-progress">
          <div className="progress-bar error"></div>
          <p className="status-text">Download failed. Please try again.</p>
          <div className="error-details-container">
            <button 
              className="error-details-toggle" 
              onClick={toggleErrorDetails}
            >
              {showErrorDetails ? 'Hide Error Details' : 'Show Error Details'}
            </button>
            {showErrorDetails && (
              <div className="error-details">
                <p>{errorDetails}</p>
              </div>
            )}
          </div>
          <div className="modal-actions error-actions">
            <button 
              className="try-again-button" 
              onClick={resetState}
            >
              Try Again
            </button>
          </div>
        </div>
      );
    } else {
      return (
        <>
          <div className="url-input-container">
            <label htmlFor="profile-url">Enter URL to download profile:</label>
            <input
              id="profile-url"
              type="text"
              className="url-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/profile.config"
            />
          </div>
          <div className="url-input-container">
            <label htmlFor="profile-name">Custom filename (optional):</label>
            <input
              id="profile-name"
              type="text"
              className="url-input"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="my_profile.config"
              disabled={isDefaultConfig}
            />
          </div>
          <div className="url-input-container update-interval">
            <label htmlFor="update-interval">自动更新间隔 (小时):</label>
            <select
              id="update-interval"
              className="url-input"
              value={updateInterval}
              onChange={(e) => setUpdateInterval(e.target.value)}
            >
              <option value="0">不自动更新</option>
              <option value="1">1小时</option>
              <option value="3">3小时</option>
              <option value="6">6小时</option>
              <option value="12">12小时</option>
              <option value="24">24小时</option>
            </select>
          </div>
          <div className="url-input-container is-default-checkbox">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isDefaultConfig}
                onChange={(e) => {
                  setIsDefaultConfig(e.target.checked);
                  if (e.target.checked) {
                    setFileName('sing-box.json');
                  }
                }}
              />
              <span>设为默认配置文件 (sing-box.json)</span>
            </label>
          </div>
        </>
      );
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleCloseModal} 
      title="ADD PROFILE"
      className={downloadStatus === 'success' ? 'success-state' : ''}
    >
      {renderDownloadStatusUI()}
      {(!isDownloading && downloadStatus === '' && !errorDetails) && (
        <div className="modal-actions">
          <button 
            className="cancel-button" 
            onClick={handleCloseModal}
          >
            Cancel
          </button>
          <button 
            className="download-button" 
            onClick={handleDownloadProfiles}
          >
            Download
          </button>
        </div>
      )}

      <style jsx>{`
        .status-text {
          margin: 8px 0;
          font-size: 14px;
          text-align: center;
          word-break: break-word;
        }
        
        .success-text {
          color: #34495e;
          font-weight: 500;
        }
        
        .update-schedule {
          font-size: 12px;
          color: #57a45d;
          margin-top: 5px;
        }
        
        .auto-close {
          margin-top: 10px;
          font-size: 12px;
          color: #666;
        }
        
        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }
        
        .checkbox-label input {
          width: 16px;
          height: 16px;
        }
        
        .download-success {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px;
          background-color: #f8fafc;
          border-radius: 8px;
          position: relative;
          z-index: 10;
        }
      `}</style>
    </Modal>
  );
};

export default ProfileModal;
