import { useState, useEffect } from 'react';

const useProfileUpdate = (setProfileData) => {
  const [updateInterval, setUpdateInterval] = useState('0');

  useEffect(() => {
    // 监听配置文件更新事件
    if (window.electron && window.electron.onProfileUpdated) {
      const removeListener = window.electron.onProfileUpdated((data) => {
        if (data.success) {
          // 重新获取配置文件数据
          window.electron.getProfileData().then((data) => {
            if (data && data.success && Array.isArray(data.profiles)) {
              setProfileData(data.profiles);
            }
          }).catch(err => {
            console.error('Failed to get profile data:', err);
          });
        }
      });

      return () => {
        removeListener();
      };
    }
  }, [setProfileData]);

  // 处理下载成功后的回调
  const handleDownloadSuccess = (downloadData) => {
    if (downloadData && downloadData.success) {
      // 下载成功后重新获取配置文件数据
      if (window.electron && window.electron.getProfileData) {
        window.electron.getProfileData().then((data) => {
          if (data && data.success && Array.isArray(data.profiles)) {
            setProfileData(data.profiles);
          }
        }).catch(err => {
          console.error('下载后获取配置文件数据失败:', err);
        });
      }
    }
  };

  return {
    updateInterval,
    setUpdateInterval,
    handleDownloadSuccess
  };
};

export default useProfileUpdate;
