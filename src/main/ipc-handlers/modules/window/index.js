/**
 * 窗口模块入口
 */
const { ipcMain } = require('electron');
const logger = require('../../../../utils/logger');
const { registerHandlers } = require('../../core/registry');
const { handlers, listeners } = require('./handlers');

/**
 * 设置窗口相关IPC处理程序
 */
function setup() {
  // 注册普通处理程序
  registerHandlers('WindowModule', handlers);
  
  // 注册监听器类型处理程序
  Object.entries(listeners).forEach(([channel, handler]) => {
    ipcMain.on(channel, handler);
  });
  
  logger.info('窗口相关IPC处理程序注册完成');
}

// 导出模块
module.exports = {
  setup
}; 