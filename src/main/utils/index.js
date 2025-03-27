/**
 * 主进程工具模块导出文件
 * 用于解决路径引用问题
 */

const { BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// 获取主窗口
function getMainWindow() {
  return BrowserWindow.getAllWindows().find(win => win.title.includes('Ivory'));
}

// 获取配置目录
function getConfigDir() {
  const userDataPath = process.env.LOCALAPPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.local/share');
  const configDir = path.join(userDataPath, 'lvory', 'configs');
  
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  return configDir;
}

// 创建响应对象
function createResponse(success, data = null, error = null) {
  return {
    success,
    data,
    error: error ? (error.message || error) : null
  };
}

module.exports = {
  getMainWindow,
  getConfigDir,
  createResponse
}; 