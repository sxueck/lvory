const { app } = require('electron');
const path = require('path');
const fs = require('fs');

/**
 * 获取应用数据目录
 * @returns {String} 应用数据目录路径
 */
function getAppDataDir() {
  // 使用LOCALAPPDATA环境变量获取Local目录路径
  const appDataDir = process.env.LOCALAPPDATA || '';
  // 确保目录名使用小写
  const appDir = path.join(appDataDir, 'lvory');
  
  if (!fs.existsSync(appDir)) {
    try {
      fs.mkdirSync(appDir, { recursive: true });
    } catch (error) {
      console.error(`创建应用数据目录失败: ${error.message}`);
    }
  }
  
  return appDir;
}

module.exports = {
  getAppDataDir
}; 