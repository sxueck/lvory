const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  window: {
    control: (action) => ipcRenderer.send('window.control', { action }),
    action: (type) => ipcRenderer.invoke('window.action', { type })
  },
  
  // 获取网络接口列表
  getNetworkInterfaces: () => ipcRenderer.invoke('get-network-interfaces'),
  
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  
  showWindow: () => ipcRenderer.invoke('show-window'),
  quitApp: () => ipcRenderer.invoke('quit-app'),
  
  // 监听窗口可见性变化事件
  onWindowVisibilityChange: (callback) => {
    ipcRenderer.on('window-visibility-change', (event, state) => callback(state));
    return () => ipcRenderer.removeListener('window-visibility-change', callback);
  },
  
  downloadProfile: (data) => ipcRenderer.invoke('download-profile', data),
  
  downloadCore: () => ipcRenderer.invoke('download-core'),
  
  onCoreDownloadProgress: (callback) => {
    ipcRenderer.on('core-download-progress', (event, progress) => callback(progress));
    return () => ipcRenderer.removeListener('core-download-progress', callback);
  },
  
  onStatusUpdate: (callback) => {
    ipcRenderer.on('status-update', (event, status) => callback(status));
    return () => ipcRenderer.removeListener('status-update', callback);
  },
  
  openConfigDir: () => ipcRenderer.invoke('openConfigDir'),
  
  // 版本更新相关
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  
  // 打开外部链接
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // 调用main进程方法
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  
  singbox: {
    checkInstalled: () => ipcRenderer.invoke('singbox-check-installed'),
    getVersion: () => ipcRenderer.invoke('singbox-get-version'),
    checkConfig: (configPath) => ipcRenderer.invoke('singbox-check-config', { configPath }),
    formatConfig: (configPath) => ipcRenderer.invoke('singbox-format-config', { configPath }),
    startCore: (options) => ipcRenderer.invoke('singbox-start-core', options),
    stopCore: () => ipcRenderer.invoke('singbox-stop-core'),
    getStatus: () => ipcRenderer.invoke('singbox-get-status'),
    run: (configPath) => ipcRenderer.invoke('singbox-run', { configPath }),
    stop: () => ipcRenderer.invoke('singbox-stop'),
    downloadCore: () => ipcRenderer.invoke('singbox-download-core'),
    
    onOutput: (callback) => {
      ipcRenderer.on('singbox-output', (event, data) => callback(data));
      return () => ipcRenderer.removeListener('singbox-output', callback);
    },
    
    onExit: (callback) => {
      ipcRenderer.on('singbox-exit', (event, data) => callback(data));
      return () => ipcRenderer.removeListener('singbox-exit', callback);
    }
  },

  getSingBoxVersion: () => ipcRenderer.invoke('singbox-get-version'),

  onCoreVersionUpdate: (callback) => {
    ipcRenderer.on('core-version-update', (event, data) => callback(data));
    return () => ipcRenderer.removeListener('core-version-update', callback);
  },
  
  onDownloadComplete: (callback) => ipcRenderer.on('download-complete', (event, data) => callback(data)),
  removeDownloadComplete: (callback) => ipcRenderer.removeListener('download-complete', callback),
  
  getProfileData: () => ipcRenderer.invoke('get-profile-data'),
  
  onProfileData: (callback) => ipcRenderer.on('profile-data', (event, data) => callback(data)),
  removeProfileData: (callback) => ipcRenderer.removeListener('profile-data', callback),
  
  // 获取配置文件列表
  getProfileFiles: () => ipcRenderer.invoke('getProfileFiles'),
  
  // 获取配置文件元数据
  getProfileMetadata: (fileName) => ipcRenderer.invoke('getProfileMetadata', fileName),
  
  // 更新配置文件
  updateProfile: (fileName) => ipcRenderer.invoke('updateProfile', fileName),
  
  // 更新所有配置文件
  updateAllProfiles: () => ipcRenderer.invoke('updateAllProfiles'),
  
  // 监听配置文件更新事件
  onProfileUpdated: (callback) => {
    ipcRenderer.on('profile-updated', (event, data) => callback(data));
    return () => ipcRenderer.removeListener('profile-updated', callback);
  },
  
  // 删除配置文件
  deleteProfile: (fileName) => ipcRenderer.invoke('deleteProfile', fileName),
  
  // 使用默认编辑器打开配置文件
  openFileInEditor: (fileName) => ipcRenderer.invoke('openFileInEditor', fileName),
  
  // 打开添加配置文件对话框
  openAddProfileDialog: () => ipcRenderer.send('open-add-profile-dialog'),
  
  // 监听配置文件变更事件
  onProfilesChanged: (callback) => {
    ipcRenderer.send('profiles-changed-listen');
    ipcRenderer.on('profiles-changed', () => callback());
    return () => {
      ipcRenderer.send('profiles-changed-unlisten');
      ipcRenderer.removeListener('profiles-changed', callback);
    };
  },
  
  getConfigPath: () => ipcRenderer.invoke('get-config-path'),
  setConfigPath: (filePath) => ipcRenderer.invoke('set-config-path', filePath),
  
  // 配置映射引擎相关API
  userConfig: {
    // 获取用户配置
    get: () => ipcRenderer.invoke('get-user-config'),
    
    // 保存用户配置
    save: (config) => ipcRenderer.invoke('save-user-config', config),
    
    // 监听用户配置更新事件
    onUpdated: (callback) => {
      ipcRenderer.on('user-config-updated', () => callback());
      return () => ipcRenderer.removeListener('user-config-updated', callback);
    }
  },
  
  mappingEngine: {
    // 获取映射定义
    getDefinition: () => ipcRenderer.invoke('get-mapping-definition'),
    
    // 保存映射定义
    saveDefinition: (mappings) => ipcRenderer.invoke('save-mapping-definition', mappings),
    
    // 应用配置映射
    applyMapping: () => ipcRenderer.invoke('apply-config-mapping'),
    
    // 获取映射定义文件路径
    getDefinitionPath: () => ipcRenderer.invoke('get-mapping-definition-path'),
    
    // 获取默认映射定义
    getDefaultDefinition: () => ipcRenderer.invoke('get-default-mapping-definition'),
    
    // 获取特定协议的映射模板
    getProtocolTemplate: (protocol) => ipcRenderer.invoke('get-protocol-template', protocol),
    
    // 创建特定协议的映射定义
    createProtocolMapping: (protocol) => ipcRenderer.invoke('create-protocol-mapping', protocol)
  },
  
  platform: process.platform,

  // 日志系统接口
  logs: {
    // 接收新的日志消息
    onLogMessage: (callback) => {
      ipcRenderer.on('log-message', (event, log) => callback(log));
      return () => ipcRenderer.removeListener('log-message', callback);
    },
    
    // 接收活动日志
    onActivityLog: (callback) => {
      ipcRenderer.on('activity-log', (event, log) => callback(log));
      return () => ipcRenderer.removeListener('activity-log', callback);
    },
    
    // 接收连接日志
    onConnectionLog: (callback) => {
      ipcRenderer.on('connection-log', (event, log) => callback(log));
      return () => ipcRenderer.removeListener('connection-log', callback);
    },
    
    // 获取之前的日志历史
    getLogHistory: () => ipcRenderer.invoke('get-log-history'),
    
    // 获取连接日志历史
    getConnectionLogHistory: () => ipcRenderer.invoke('get-connection-log-history'),
    
    // 清除日志历史
    clearLogs: () => ipcRenderer.invoke('clear-logs'),
    
    // 清除连接日志历史
    clearConnectionLogs: () => ipcRenderer.invoke('clear-connection-logs'),
    
    // 启动连接监听
    startConnectionMonitoring: () => ipcRenderer.invoke('start-connection-monitoring'),
    
    // 停止连接监听
    stopConnectionMonitoring: () => ipcRenderer.invoke('stop-connection-monitoring')
  },

  // 开机自启动相关API
  setAutoLaunch: (enable) => ipcRenderer.invoke('set-auto-launch', enable),
  getAutoLaunch: () => ipcRenderer.invoke('get-auto-launch'),
  
  // 设置相关API
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  getSettings: () => ipcRenderer.invoke('get-settings'),

  // 获取规则集
  getRuleSets: () => ipcRenderer.invoke('get-rule-sets'),

  // 获取节点组信息
  getNodeGroups: () => ipcRenderer.invoke('get-node-groups'),

  // 获取当前配置文件内容
  getCurrentConfig: () => ipcRenderer.invoke('get-current-config'),

  // 添加引擎到窗口对象，用于前端直接使用
  engine: {
    getValueByPath: (obj, path) => {
      // 这里简单实现getValueByPath，如果需要更复杂的实现，可以考虑引入完整的引擎
      try {
        const keys = path.split('.');
        let current = obj;
        for (let key of keys) {
          if (current === null || current === undefined) return undefined;
          current = current[key];
        }
        return current;
      } catch (error) {
        console.error('获取路径值失败:', error);
        return undefined;
      }
    }
  },

  // 节点历史数据相关API
  getNodeHistory: (nodeTag) => ipcRenderer.invoke('get-node-history', nodeTag),
  isNodeHistoryEnabled: () => ipcRenderer.invoke('is-node-history-enabled'),
  loadAllNodeHistory: () => ipcRenderer.invoke('load-all-node-history'),
  
  // 节点累计流量相关API
  getNodeTotalTraffic: (nodeTag) => ipcRenderer.invoke('get-node-total-traffic', nodeTag),
  getAllNodesTotalTraffic: () => ipcRenderer.invoke('get-all-nodes-total-traffic'),
  resetNodeTotalTraffic: (nodeTag) => ipcRenderer.invoke('reset-node-total-traffic', nodeTag),

  // 监听代理状态恢复
  onProxyStateRestored: (callback) => {
    ipcRenderer.on('proxy-state-restored', callback);
  },
  removeProxyStateRestored: (callback) => {
    ipcRenderer.removeListener('proxy-state-restored', callback);
  },
}); 