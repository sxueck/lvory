/**
 * IPC事件处理模块入口
 * 统一管理Electron的IPC通信处理
 */
const { ipcMain } = require('electron');
const logger = require('../../utils/logger');

// 加载所有处理程序模块
let profileHandlers; 
let singboxHandlers;
let downloadHandlers;
let settingsHandlers;
let updateHandlers;
let nodeHistoryHandlers;
let tracerouteHandlers;
let coreManagerHandlers;
let coreHandlers;

let ipcHandlersRegistered = false;

// 所有需要移除的处理程序列表
const HANDLERS_TO_REMOVE = [
  // 配置相关
  'get-config-path', 'set-config-path', 'open-config-dir',
  // 配置文件相关
  'get-profile-data', 'getProfileFiles', 'deleteProfile', 
  'openFileInEditor', 'openConfigDir', 'getProfileMetadata', 
  'updateProfile', 'updateAllProfiles', 'loadLocalProfile',
  'profiles-changed-listen', 'profiles-changed-unlisten',
  // Singbox相关
  'singbox-start-core', 'singbox-stop-core', 'singbox-get-status', 
  'singbox-get-version', 'singbox-check-installed', 'singbox-check-config', 
  'singbox-format-config', 'singbox-download-core', 'singbox-run', 'singbox-stop',
  // 下载相关
  'download-core', 'download-profile',
  // 窗口相关
  'show-window', 'quit-app', 'window-minimize', 'window-maximize', 'window-close',
  // 日志相关
  'get-log-history', 'clear-logs', 'get-connection-log-history', 'clear-connection-logs',
  'start-connection-monitoring', 'stop-connection-monitoring',
  'get-singbox-log-files', 'read-singbox-log-file', 'get-current-singbox-log',
  // 设置相关
  'set-auto-launch', 'get-auto-launch', 'save-settings', 'get-settings',
  // 节点历史数据相关
  'get-node-history', 'is-node-history-enabled', 'load-all-node-history',
  'get-node-total-traffic', 'get-all-nodes-total-traffic', 'reset-node-total-traffic',
  // 用户配置相关
  'get-user-config', 'save-user-config',
  // 规则集相关
  'get-rule-sets', 'get-node-groups', 'get-route-rules',
  // 映射引擎相关
  'get-mapping-definition', 'save-mapping-definition', 'apply-config-mapping',
  'get-mapping-definition-path', 'get-default-mapping-definition',
  'get-protocol-template', 'create-protocol-mapping',
  // 网络接口相关
  'get-network-interfaces',
  // 应用版本相关
  'get-app-version',
  'get-build-date',
  'get-is-portable',
  'get-run-mode-info',
  // 版本更新相关
  'check-for-updates',
  'get-all-versions',
  // 外部链接相关
  'open-external',
  // Traceroute 相关
  'traceroute:execute',
  'traceroute:validate'
];

/**
 * 加载指定模块
 * @param {String} name 模块名称
 * @returns {Object} 加载的模块
 */
function loadHandlerModule(name) {
  try {
    logger.info(`加载IPC处理程序模块: ${name}`);
    return require(`./${name}-handlers`);
  } catch (error) {
    logger.error(`加载IPC处理程序模块 ${name} 失败:`, error);
    return null;
  }
}

/**
 * 注册所有IPC处理程序
 */
function setupHandlers() {
  if (ipcHandlersRegistered) {
    logger.warn('IPC处理程序已注册，跳过');
    return;
  }
  
  try {
    // 加载所有处理程序模块
    profileHandlers = loadHandlerModule('profile');
    singboxHandlers = loadHandlerModule('singbox');
    downloadHandlers = loadHandlerModule('download');
    settingsHandlers = loadHandlerModule('settings');
    updateHandlers = loadHandlerModule('update');
    nodeHistoryHandlers = loadHandlerModule('node-history');
    tracerouteHandlers = loadHandlerModule('traceroute');
    coreManagerHandlers = loadHandlerModule('core-manager');
    coreHandlers = loadHandlerModule('core');
    
    // 导入工具模块
    const utils = require('./utils');
    
    // 设置所有处理程序
    if (profileHandlers) profileHandlers.setup();
    if (singboxHandlers) singboxHandlers.setup();
    if (downloadHandlers) downloadHandlers.setup();
    if (settingsHandlers) settingsHandlers.setup();
    if (updateHandlers) updateHandlers.setup();
    if (nodeHistoryHandlers) nodeHistoryHandlers.setup();
    if (tracerouteHandlers) tracerouteHandlers.registerTracerouteHandlers();
    if (coreManagerHandlers) coreManagerHandlers.setup();
    if (coreHandlers) coreHandlers.setup();
    
    // 设置网络接口处理程序
    utils.getNetworkInterfaces();
    utils.getAppVersion();
    utils.getBuildDate();
    
    // 设置便携模式检测处理程序
    utils.getIsPortable();

    // 设置运行模式信息处理程序
    utils.getAppRunModeInfo();

    // 设置版本更新检查处理程序
    utils.checkForUpdates();
    utils.getAllVersions();
    utils.openExternal();
    
    ipcHandlersRegistered = true;
    logger.info('所有IPC处理程序注册成功');
  } catch (error) {
    logger.error('注册IPC处理程序失败:', error);
  }
}

/**
 * 清理所有IPC处理程序
 */
function cleanupHandlers() {
  if (!ipcHandlersRegistered) {
    return;
  }
  
  logger.info('正在清理IPC处理程序...');
  
  HANDLERS_TO_REMOVE.forEach((channel) => {
    try {
      if (channel.endsWith('-listen') || channel.endsWith('-unlisten')) {
        ipcMain.removeAllListeners(channel);
      } else {
        ipcMain.removeHandler(channel);
      }
    } catch (error) {
      logger.warn(`移除处理程序 ${channel} 失败:`, error);
    }
  });
  
  ipcHandlersRegistered = false;
  logger.info('IPC处理程序已清理');
}

module.exports = {
  setupHandlers,
  cleanupHandlers
}; 