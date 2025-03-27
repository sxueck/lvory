/**
 * 下载模块入口
 */
const logger = require('../../../../utils/logger');
const { registerHandlers } = require('../../core/registry');
const { handlers } = require('./handlers');

/**
 * 设置下载相关IPC处理程序
 */
function setup() {
  // 注册处理程序
  registerHandlers('DownloadModule', handlers);
  
  logger.info('下载相关IPC处理程序注册完成');
}

// 导出模块
module.exports = {
  setup
}; 