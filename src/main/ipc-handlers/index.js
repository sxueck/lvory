/**
 * IPC事件处理模块入口
 * 统一管理Electron的IPC通信处理
 * 提供优化的注册机制和二次注册拦截
 */
const { ipcMain } = require('electron');
const logger = require('../../utils/logger');
const path = require('path');
const { 
  removeHandlers, 
  isHandlerRegistered, 
  getAllRegisteredChannels,
  getRegistrationHistory,
  register
} = require('./core/registry');

// 模块列表
const moduleList = [
  // 核心模块（优先加载）
  'window',
  'profile', 
  'singbox',
  'sync',
  // 其他模块
  'download',
  'settings',
  'update',
  'nodeHistory',
  'status'
];

// 注册状态标志
let ipcHandlersRegistered = false;

// 注册锁，防止并发注册
let registrationLock = false;

// 注册尝试计数
let registrationAttempts = 0;
const MAX_REGISTRATION_ATTEMPTS = 3;

/**
 * 注册内部处理程序
 */
function registerInternalHandlers() {
  for (const [channel, handler] of Object.entries(internalHandlers)) {
    try {
      // 使用registry模块的register函数注册
      register('InternalModule', channel, handler);
      logger.debug(`注册内部处理程序: ${channel}`);
    } catch (error) {
      logger.error(`注册内部处理程序失败: ${channel}`, error);
    }
  }
}

/**
 * 注册所有IPC处理程序
 * @returns {Promise<boolean>} 是否成功注册
 */
async function setupHandlers() {
  // 增加注册尝试计数
  registrationAttempts++;
  
  // 检查是否超过最大尝试次数
  if (registrationAttempts > MAX_REGISTRATION_ATTEMPTS) {
    logger.error(`IPC处理程序注册失败: 超过最大尝试次数 (${MAX_REGISTRATION_ATTEMPTS})`);
    return false;
  }
  
  // 热重载环境下，先清理旧的处理程序
  if (process.env.NODE_ENV === 'development' && ipcHandlersRegistered) {
    logger.info('开发环境: 清理旧IPC处理程序');
    await cleanupHandlers();
  }
  
  // 检查是否已注册（清理后应该为false）
  if (ipcHandlersRegistered) {
    logger.warn('IPC处理程序已注册，跳过');
    return true;
  }
  
  // 检查注册锁
  if (registrationLock) {
    logger.warn('IPC处理程序注册正在进行中');
    return false;
  }
  
  // 获取注册锁
  registrationLock = true;
  
  try {
    logger.info('开始注册IPC处理程序');
    
    // 划分核心模块和其他模块
    const coreModules = moduleList.filter(name => 
      ['window', 'profile', 'singbox', 'sync'].includes(name)
    );
    const otherModules = moduleList.filter(name => 
      !['window', 'profile', 'singbox', 'sync'].includes(name)
    );
    
    // 优先加载核心模块
    let coreSuccess = 0;
    for (const moduleName of coreModules) {
      if (await loadModule(moduleName, true)) {
        coreSuccess++;
      }
    }
    logger.info(`核心模块加载: ${coreSuccess}/${coreModules.length}个成功`);
    
    // 加载其他模块
    let otherSuccess = 0;
    for (const moduleName of otherModules) {
      if (await loadModule(moduleName, false)) {
        otherSuccess++;
      }
    }
    logger.info(`其他模块加载: ${otherSuccess}/${otherModules.length}个成功`);
    
    // 注册内部处理程序
    registerInternalHandlers();
    
    ipcHandlersRegistered = true;
    logger.info('IPC处理程序注册完成');
    return true;
  } catch (error) {
    logger.error('注册IPC处理程序失败:', error);
    return false;
  } finally {
    // 释放注册锁
    registrationLock = false;
  }
}

/**
 * 加载单个模块
 * @param {String} moduleName 模块名称
 * @param {Boolean} isCore 是否为核心模块
 * @returns {Promise<boolean>}
 */
async function loadModule(moduleName, isCore = false) {
  try {
    // 处理模块名称映射（实际目录名）
    const moduleNameMap = {
      'window': 'window',
      'profile': 'profile',
      'singbox': 'singbox',
      'sync': 'sync',
      'download': 'download',
      'settings': 'settings',
      'update': 'update',
      'nodeHistory': 'node-history',
      'status': 'status'
    };
    
    // 获取实际目录名
    const dirName = moduleNameMap[moduleName] || moduleName.toLowerCase();
    
    // 构建模块路径
    const modulePath = path.join(__dirname, 'modules', dirName);
    
    logger.info(`正在加载模块: ${moduleName}，路径: ${modulePath}`);
    
    try {
      // 尝试加载模块
      const moduleInstance = require(modulePath);
      
      logger.info(`模块 ${moduleName} 加载成功，接口: ${Object.keys(moduleInstance).join(', ')}`);
      
      // 初始化模块
      if (moduleInstance && typeof moduleInstance.setup === 'function') {
        await moduleInstance.setup();
        return true;
      } else {
        logger.warn(`模块 ${moduleName} 缺少setup方法`);
        return false;
      }
    } catch (moduleError) {
      logger.error(`模块 ${moduleName} 加载失败: ${moduleError.message}`);
      return false;
    }
  } catch (error) {
    logger.error(`加载模块 ${moduleName} 失败:`, error);
    return false;
  }
}

/**
 * 清理所有IPC处理程序
 * @returns {Promise<void>}
 */
async function cleanupHandlers() {
  if (!ipcHandlersRegistered) {
    return;
  }
  
  logger.info('清理IPC处理程序');
  let removedCount = 0;
  
  // 移除已注册的通道
  const registeredChannels = getAllRegisteredChannels();
  for (const channel of registeredChannels) {
    try {
      if (ipcMain.removeHandler) {
        ipcMain.removeHandler(channel);
      }
      ipcMain.removeAllListeners(channel);
      removedCount++;
    } catch (error) {
      logger.debug(`移除通道失败: ${channel}`, error);
    }
  }
  
  // 重置registry并强制重新注册
  const registry = require('./core/registry');
  registry.resetRegistry();
  
  ipcHandlersRegistered = false;
  logger.info(`IPC处理程序清理: 移除了${removedCount}个`);
}

/**
 * 获取注册状态
 * @returns {Object} 注册状态
 */
function getRegistrationStatus() {
  return {
    registered: ipcHandlersRegistered,
    attempts: registrationAttempts,
    channels: getAllRegisteredChannels()
  };
}

module.exports = {
  setupHandlers,
  cleanupHandlers,
  getRegistrationStatus
};
