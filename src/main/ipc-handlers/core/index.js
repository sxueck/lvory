/**
 * IPC处理程序核心模块入口
 * 提供核心注册和工具功能
 */

// 导出注册表功能
const registry = require('./registry');

// 导出工具函数
const utils = require('./utils');

// 导出所有功能
module.exports = {
  // 注册表功能
  register: registry.register,
  registerHandlers: registry.registerHandlers,
  removeHandlers: registry.removeHandlers,
  isHandlerRegistered: registry.isHandlerRegistered,
  getAllRegisteredChannels: registry.getAllRegisteredChannels,
  getRegistrationHistory: registry.getRegistrationHistory,
  
  // 工具函数
  getMainWindow: utils.getMainWindow,
  sendToMainWindow: utils.sendToMainWindow,
  formatError: utils.formatError,
  createResponse: utils.createResponse
}; 