/**
 * IPC处理程序注册表
 * 提供处理程序注册状态追踪和管理
 */
const { ipcMain } = require('electron');
const logger = require('../../../utils/logger');

// 由于WeakMap的键必须是对象，我们需要一个对象来存储通道名到通道对象的映射
const channelObjects = {};

// 通道注册映射 - 记录每个通道的注册信息
// 格式: { channelObj => { module, isListener, registeredAt, options, name } }
const channelRegistry = new WeakMap();

// 注册历史记录
// 格式: [{ channel, module, action, timestamp, success, error, options }]
const registrationHistory = [];

// 最大历史记录数量
const MAX_HISTORY_SIZE = 100;

/**
 * 获取或创建通道对象
 * @param {String} channel 通道名称
 * @returns {Object} 通道对象
 */
function getChannelObject(channel) {
  if (!channelObjects[channel]) {
    channelObjects[channel] = { name: channel };
  }
  return channelObjects[channel];
}

/**
 * 检查处理程序是否已注册
 * @param {String} channel IPC通道名称
 * @returns {Boolean} 是否已注册
 */
function isHandlerRegistered(channel) {
  const channelObj = channelObjects[channel];
  return channelObj && channelRegistry.has(channelObj);
}

/**
 * 获取所有已注册的通道
 * @returns {Array<String>} 已注册的通道列表
 */
function getAllRegisteredChannels() {
  return Object.keys(channelObjects).filter(channel => {
    const channelObj = channelObjects[channel];
    return channelRegistry.has(channelObj);
  });
}

/**
 * 获取注册历史记录
 * @param {Number} limit 限制返回的记录数量
 * @returns {Array} 注册历史记录
 */
function getRegistrationHistory(limit = MAX_HISTORY_SIZE) {
  return registrationHistory.slice(-limit);
}

/**
 * 添加注册历史记录
 * @param {Object} record 历史记录
 */
function addRegistrationHistory(record) {
  registrationHistory.push({
    ...record,
    timestamp: Date.now()
  });
  
  // 限制历史记录大小
  if (registrationHistory.length > MAX_HISTORY_SIZE) {
    registrationHistory.shift();
  }
}

/**
 * 注册单个处理程序
 * @param {String} moduleName 模块名称
 * @param {String} channel IPC通道名称
 * @param {Function} handler 处理函数
 * @param {Boolean} isListener 是否为监听器类型
 * @param {Object} options 注册选项
 * @returns {Boolean} 是否成功注册
 */
function register(moduleName, channel, handler, isListener = false, options = {}) {
  try {
    // 检查通道是否已注册
    if (isHandlerRegistered(channel) && !options.force) {
      logger.warn(`通道 ${channel} 已注册，跳过`);
      
      // 记录历史
      addRegistrationHistory({
        channel,
        module: moduleName,
        action: 'register-skip',
        success: false,
        error: '通道已注册',
        options
      });
      
      return false;
    }
    
    // 注册处理程序
    if (isListener) {
      ipcMain.on(channel, handler);
    } else {
      ipcMain.handle(channel, handler);
    }
    
    // 获取或创建通道对象
    const channelObj = getChannelObject(channel);
    
    // 更新通道注册表
    channelRegistry.set(channelObj, {
      module: moduleName,
      isListener,
      registeredAt: Date.now(),
      options,
      name: channel
    });
    
    // 记录历史
    addRegistrationHistory({
      channel,
      module: moduleName,
      action: 'register',
      success: true,
      options
    });
    
    logger.debug(`已注册${isListener ? '监听器' : '处理程序'}: ${channel}`);
    return true;
  } catch (error) {
    logger.error(`注册处理程序失败: ${channel}`, error);
    
    // 记录历史
    addRegistrationHistory({
      channel,
      module: moduleName,
      action: 'register-error',
      success: false,
      error: error.message,
      options
    });
    
    return false;
  }
}

/**
 * 批量注册处理程序
 * @param {String} moduleName 模块名称
 * @param {Object} handlers 处理程序对象
 * @param {Boolean} isListener 是否为监听器类型
 * @param {Object} options 注册选项
 * @returns {Number} 成功注册的处理程序数量
 */
function registerHandlers(moduleName, handlers, isListener = false, options = {}) {
  if (!handlers || typeof handlers !== 'object') {
    logger.warn(`注册处理程序失败: ${moduleName} 处理程序对象无效`);
    return 0;
  }
  
  let count = 0;
  let failed = 0;
  
  for (const [channel, handler] of Object.entries(handlers)) {
    if (typeof handler !== 'function') {
      logger.warn(`${moduleName}: 跳过无效处理程序 ${channel}`);
      continue;
    }
    
    try {
      if (isHandlerRegistered(channel) && !options.force) {
        logger.debug(`${moduleName}: 通道 ${channel} 已注册，跳过`);
        continue;
      }
      
      if (isListener) {
        ipcMain.on(channel, handler);
      } else {
        ipcMain.handle(channel, handler);
      }
      
      // 获取或创建通道对象
      const channelObj = getChannelObject(channel);
      
      // 更新通道注册表
      channelRegistry.set(channelObj, {
        module: moduleName,
        isListener,
        registeredAt: Date.now(),
        options,
        name: channel
      });
      
      // 记录历史
      addRegistrationHistory({
        channel,
        module: moduleName,
        action: 'register',
        success: true,
        options
      });
      
      count++;
    } catch (error) {
      logger.error(`${moduleName}: 注册处理程序 ${channel} 失败:`, error);
      
      // 记录历史
      addRegistrationHistory({
        channel,
        module: moduleName,
        action: 'register-error',
        success: false,
        error: error.message,
        options
      });
      
      failed++;
    }
  }
  
  if (count > 0 || failed > 0) {
    logger.info(`模块 ${moduleName} 注册: ${count}个成功${failed > 0 ? `, ${failed}个失败` : ''}`);
  }
  
  return count;
}

/**
 * 移除特定模块的所有处理程序
 * @param {String} moduleName 模块名称
 * @returns {Number} 移除的处理程序数量
 */
function removeHandlers(moduleName) {
  try {
    let count = 0;
    
    // 查找该模块注册的所有通道
    const channelsToRemove = [];
    
    for (const channel of Object.keys(channelObjects)) {
      const channelObj = channelObjects[channel];
      const info = channelRegistry.get(channelObj);
      
      if (info && info.module === moduleName) {
        channelsToRemove.push(channel);
      }
    }
    
    // 移除处理程序
    for (const channel of channelsToRemove) {
      try {
        const channelObj = channelObjects[channel];
        const info = channelRegistry.get(channelObj);
        
        if (info.isListener) {
          ipcMain.removeAllListeners(channel);
        } else if (ipcMain.removeHandler) {
          ipcMain.removeHandler(channel);
        }
        
        // 将通道对象从映射中删除，这样它可以被垃圾回收
        delete channelObjects[channel];
        count++;
        
        // 记录历史
        addRegistrationHistory({
          channel,
          module: moduleName,
          action: 'remove',
          success: true
        });
      } catch (error) {
        logger.warn(`移除处理程序失败: ${channel}`, error);
        
        // 记录历史
        addRegistrationHistory({
          channel,
          module: moduleName,
          action: 'remove-error',
          success: false,
          error: error.message
        });
      }
    }
    
    logger.debug(`已移除模块 ${moduleName} 的 ${count} 个处理程序`);
    return count;
  } catch (error) {
    logger.error('移除处理程序失败', error);
    return 0;
  }
}

// 导出所有方法
module.exports = {
  register,
  registerHandlers,
  removeHandlers,
  isHandlerRegistered,
  getAllRegisteredChannels,
  getRegistrationHistory,
  
  /**
   * 重置注册表状态
   * 用于热重载时强制清除所有注册信息
   */
  resetRegistry: () => {
    // 清空channelObjects，强制重新创建所有通道对象
    for (const key of Object.keys(channelObjects)) {
      delete channelObjects[key];
    }
    
    // 记录重置操作
    addRegistrationHistory({
      channel: 'all',
      module: 'system',
      action: 'reset-registry',
      success: true
    });
    
    logger.info('注册表已重置');
  }
}; 