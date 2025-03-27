/**
 * IPC处理程序通用工具函数
 */
const { BrowserWindow } = require('electron');
const logger = require('../../../utils/logger');

/**
 * 获取主窗口实例
 * @returns {BrowserWindow|null} 主窗口实例或null
 */
function getMainWindow() {
  try {
    const allWindows = BrowserWindow.getAllWindows();
    
    // 按创建顺序找到第一个非开发者工具的窗口
    for (const win of allWindows) {
      // 跳过开发者工具窗口
      if (win.webContents && !win.webContents.isDevToolsFocused()) {
        return win;
      }
    }
    
    // 如果没有找到合适的窗口，返回第一个窗口或null
    return allWindows.length > 0 ? allWindows[0] : null;
  } catch (error) {
    logger.error('获取主窗口失败:', error);
    return null;
  }
}

/**
 * 向主窗口发送事件
 * @param {String} channel 事件通道名
 * @param {*} data 要发送的数据
 * @returns {Boolean} 是否成功发送
 */
function sendToMainWindow(channel, data) {
  try {
    const mainWindow = getMainWindow();
    
    if (!mainWindow || mainWindow.isDestroyed()) {
      logger.warn(`向主窗口发送事件失败: 窗口不存在或已销毁`);
      return false;
    }
    
    mainWindow.webContents.send(channel, data);
    return true;
  } catch (error) {
    logger.error(`向主窗口发送事件失败: ${channel}`, error);
    return false;
  }
}

/**
 * 格式化错误信息
 * @param {Error|String} error 错误对象或错误消息
 * @returns {String} 格式化后的错误消息
 */
function formatError(error) {
  if (!error) {
    return '未知错误';
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (error instanceof Error) {
    return error.message || error.toString();
  }
  
  return String(error);
}

/**
 * 创建标准响应对象
 * @param {Boolean} success 是否成功
 * @param {*} data 响应数据
 * @param {Error|String} [error] 错误信息
 * @returns {Object} 标准响应对象
 */
function createResponse(success, data = null, error = null) {
  const response = { success };
  
  if (data !== null && data !== undefined) {
    response.data = data;
  }
  
  if (!success && error) {
    response.error = formatError(error);
  }
  
  return response;
}

module.exports = {
  getMainWindow,
  sendToMainWindow,
  formatError,
  createResponse
}; 