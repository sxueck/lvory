/**
 * 更新模块入口
 */
const logger = require('../../../../utils/logger');
const { registerHandlers } = require('../../core/registry');
const { handlers } = require('./handlers');

/**
 * 设置更新相关IPC处理程序
 */
function setup() {
  // 注册普通处理程序
  registerHandlers('UpdateModule', handlers);
  
  logger.info('更新相关IPC处理程序注册完成');
}

// 导出模块
module.exports = {
  setup
}; 