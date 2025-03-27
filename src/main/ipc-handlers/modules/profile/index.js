/**
 * 配置文件模块入口
 */
const logger = require('../../../../utils/logger');
const { registerHandlers } = require('../../core/registry');
const handlers = require('./handlers');

/**
 * 设置配置文件相关IPC处理程序
 */
function setup() {
  // 注册处理程序
  const count = registerHandlers('profile', handlers);
  logger.info(`配置文件模块: 注册了${count}个IPC处理程序`);
}

// 导出模块
module.exports = {
  setup
}; 