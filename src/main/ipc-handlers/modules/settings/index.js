/**
 * 设置模块入口
 */
const logger = require('../../../../utils/logger');
const { registerHandlers } = require('../../core/registry');
const { handlers } = require('./handlers');

/**
 * 设置相关IPC处理程序
 */
function setup() {
  // 注册处理程序
  registerHandlers('SettingsModule', handlers);
  
  logger.info('设置相关IPC处理程序注册完成');
}

// 导出模块
module.exports = {
  setup
}; 