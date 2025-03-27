/**
 * IPC事件处理模块
 * 统一管理Electron的IPC通信处理
 * 提供优化的注册机制
 */
const { 
  setupHandlers, 
  cleanupHandlers, 
  getRegistrationStatus
} = require('./ipc-handlers/index');

module.exports = {
  // 核心功能
  setupHandlers,
  cleanupHandlers,
  
  // 状态查询
  getRegistrationStatus
};
