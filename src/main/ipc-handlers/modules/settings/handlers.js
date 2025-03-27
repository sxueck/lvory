/**
 * 设置相关IPC处理程序
 */
const logger = require('../../../../utils/logger');
const settingsManager = require('../../../settings-manager');
const { createResponse } = require('../../core/utils');

// 处理程序对象
const handlers = {
  // 获取日志历史记录
  'get-log-history': async () => {
    try {
      const history = logger.getHistory();
      return createResponse(true, history);
    } catch (error) {
      logger.error('获取日志历史记录失败:', error);
      return createResponse(false, null, error);
    }
  },

  // 清除日志
  'clear-logs': async () => {
    try {
      const result = logger.clearHistory();
      return createResponse(true, result);
    } catch (error) {
      logger.error('清除日志失败:', error);
      return createResponse(false, null, error);
    }
  },
  
  // 设置开机自启动
  'set-auto-launch': async (event, enable) => {
    try {
      const result = await settingsManager.setAutoLaunch(enable);
      return createResponse(true, result);
    } catch (error) {
      logger.error('设置开机自启动失败:', error);
      return createResponse(false, null, error);
    }
  },

  // 获取开机自启动状态
  'get-auto-launch': async () => {
    try {
      const enabled = await settingsManager.getAutoLaunch();
      return createResponse(true, { enabled });
    } catch (error) {
      logger.error('获取开机自启动状态失败:', error);
      return createResponse(false, null, error);
    }
  },
  
  // 保存设置
  'save-settings': async (event, settings) => {
    try {
      const result = await settingsManager.saveSettings(settings);
      return createResponse(true, result);
    } catch (error) {
      logger.error('保存设置失败:', error);
      return createResponse(false, null, error);
    }
  },

  // 加载设置
  'get-settings': async () => {
    try {
      const settings = await settingsManager.loadSettings();
      return createResponse(true, { settings });
    } catch (error) {
      logger.error('加载设置失败:', error);
      return createResponse(false, null, error);
    }
  }
};

// 导出所有处理程序
module.exports = {
  handlers
}; 