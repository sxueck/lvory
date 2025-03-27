/**
 * 窗口相关IPC处理程序
 */
const logger = require('../../../../utils/logger');
const singbox = require('../../../../utils/sing-box');
const { createResponse } = require('../../core/utils');

// 处理程序对象
const handlers = {
  // 显示窗口
  'show-window': () => {
    const windowManager = require('../../../window');
    windowManager.showWindow();
    return createResponse(true);
  },
  
  // 真正退出应用
  'quit-app': async () => {
    try {
      // 退出前清理
      await singbox.disableSystemProxy();
      await singbox.stopCore();
      
      // 标记为真正退出
      global.isQuitting = true;
      require('electron').app.quit();
      return createResponse(true);
    } catch (error) {
      logger.error('退出应用失败:', error);
      return createResponse(false, null, error);
    }
  }
};

// 监听器类型处理程序
const listeners = {
  // 窗口控制
  'window-control': (event, command) => {
    const { getMainWindow } = require('../../core/utils');
    const mainWindow = getMainWindow();
    if (!mainWindow) return;
    
    switch (command) {
      case 'minimize':
        // 改为隐藏窗口而不是最小化
        mainWindow.hide();
        break;
      case 'maximize':
        if (mainWindow.isMaximized()) {
          mainWindow.restore();
          // 确保恢复后的窗口不小于最小尺寸
          const [width, height] = mainWindow.getSize();
          if (width < 800 || height < 600) {
            mainWindow.setSize(Math.max(width, 800), Math.max(height, 600));
          }
        } else {
          mainWindow.maximize();
        }
        break;
      case 'close':
        // 只是隐藏窗口，不真正关闭
        mainWindow.hide();
        break;
    }
  }
};

// 导出所有处理程序
module.exports = {
  handlers,
  listeners
}; 