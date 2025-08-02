const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // 统一的窗口管理接口
  window: {
    control: (action) => ipcRenderer.send('window.control', { action }),
    action: (type) => ipcRenderer.invoke('window.action', { type }),
    minimize: () => ipcRenderer.send('window.control', { action: 'minimize' }),
    maximize: () => ipcRenderer.send('window.control', { action: 'maximize' }),
    close: () => ipcRenderer.send('window.control', { action: 'close' }),
    show: () => ipcRenderer.invoke('window.action', { type: 'show' }),
    quit: () => ipcRenderer.invoke('window.action', { type: 'quit' }),
    onVisibilityChange: (callback) => {
      ipcRenderer.on('window-visibility-change', (event, state) => callback(state));
      return () => ipcRenderer.removeListener('window-visibility-change', callback);
    }
  },
  
  // 获取网络接口列表
  getNetworkInterfaces: () => ipcRenderer.invoke('get-network-interfaces'),
  
  // 统一的下载管理接口
  download: {
    profile: (data) => ipcRenderer.invoke('download-profile', data),
    core: () => ipcRenderer.invoke('download-core'),
    onCoreProgress: (callback) => {
      ipcRenderer.on('core-download-progress', (event, progress) => callback(progress));
      return () => ipcRenderer.removeListener('core-download-progress', callback);
    },
    onComplete: (callback) => {
      ipcRenderer.on('download-complete', (event, data) => callback(data));
      return () => ipcRenderer.removeListener('download-complete', callback);
    }
  },
  
  onStatusUpdate: (callback) => {
    ipcRenderer.on('status-update', (event, status) => callback(status));
    return () => ipcRenderer.removeListener('status-update', callback);
  },
  
  openConfigDir: () => ipcRenderer.invoke('openConfigDir'),
  
  // 打开外部链接
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // 获取运行模式信息
  getRunModeInfo: () => ipcRenderer.invoke('get-run-mode-info'),

  // 调用main进程方法
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  
  // 获取配置目录
  getConfigDir: () => ipcRenderer.invoke('get-config-dir'),
  
  // 统一的SingBox管理接口
  singbox: {
    checkInstalled: () => ipcRenderer.invoke('singbox-check-installed'),
    getVersion: () => ipcRenderer.invoke('singbox-get-version'),
    checkConfig: (configPath) => ipcRenderer.invoke('singbox-check-config', { configPath }),
    formatConfig: (configPath) => ipcRenderer.invoke('singbox-format-config', { configPath }),
    startCore: (options) => ipcRenderer.invoke('singbox-start-core', options),
    stopCore: () => ipcRenderer.invoke('singbox-stop-core'),
    getStatus: () => ipcRenderer.invoke('singbox-get-status'),
    getDetailedStatus: () => ipcRenderer.invoke('singbox-get-detailed-status'),
    checkStopPermission: () => ipcRenderer.invoke('singbox-check-stop-permission'),
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
    },
    
    onVersionUpdate: (callback) => {
      ipcRenderer.on('core-version-update', (event, data) => callback(data));
      return () => ipcRenderer.removeListener('core-version-update', callback);
    }
  },
  
  // 统一的配置文件管理接口
  profiles: {
    getData: () => ipcRenderer.invoke('get-profile-data'),
    getFiles: () => ipcRenderer.invoke('getProfileFiles'),
    getMetadata: (fileName) => ipcRenderer.invoke('getProfileMetadata', fileName),
    update: (fileName) => ipcRenderer.invoke('update-profile', fileName),
    updateAll: () => ipcRenderer.invoke('update-all-profiles'),
    delete: (fileName) => ipcRenderer.invoke('deleteProfile', fileName),
    openInEditor: (fileName) => ipcRenderer.invoke('openFileInEditor', fileName),
    openAddDialog: () => ipcRenderer.send('open-add-profile-dialog'),
    refreshLvorySync: () => ipcRenderer.invoke('refresh-lvory-sync'),
    applyModeMapping: (mappingConfig) => ipcRenderer.invoke('apply-mode-mapping', mappingConfig),
    applyMappings: (mappingConfig) => ipcRenderer.invoke('apply-mappings', mappingConfig),
    
    onData: (callback) => {
      ipcRenderer.on('profile-data', (event, data) => callback(data));
      return () => ipcRenderer.removeListener('profile-data', callback);
    },
    
    onUpdated: (callback) => {
      ipcRenderer.on('profile-updated', (event, data) => callback(data));
      return () => ipcRenderer.removeListener('profile-updated', callback);
    },
    
    onChanged: (callback) => {
      ipcRenderer.send('profiles-changed-listen');
      ipcRenderer.on('profiles-changed', () => callback());
      return () => {
        ipcRenderer.send('profiles-changed-unlisten');
        ipcRenderer.removeListener('profiles-changed', callback);
      };
    }
  },
  
  // 统一的配置路径管理接口
  config: {
    getPath: () => ipcRenderer.invoke('get-config-path'),
    setPath: (filePath) => ipcRenderer.invoke('set-config-path', filePath),
    getCurrent: () => ipcRenderer.invoke('get-current-config'),
    reprocess: () => ipcRenderer.invoke('reprocess-current-config')
  },
  
  // Dashboard刷新事件监听
  onConfigChanged: (callback) => {
    ipcRenderer.on('config-changed', callback);
    return () => ipcRenderer.removeListener('config-changed', callback);
  },
  
  onDashboardRefresh: (callback) => {
    ipcRenderer.on('dashboard-refresh', callback);
    return () => ipcRenderer.removeListener('dashboard-refresh', callback);
  },
  
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

  // 统一的日志管理接口
  logs: {
    onMessage: (callback) => {
      ipcRenderer.on('log-message', (event, log) => callback(log));
      return () => ipcRenderer.removeListener('log-message', callback);
    },
    
    onActivity: (callback) => {
      ipcRenderer.on('activity-log', (event, log) => callback(log));
      return () => ipcRenderer.removeListener('activity-log', callback);
    },
    
    onConnection: (callback) => {
      ipcRenderer.on('connection-log', (event, log) => callback(log));
      return () => ipcRenderer.removeListener('connection-log', callback);
    },
    
    getHistory: () => ipcRenderer.invoke('get-log-history'),
    getConnectionHistory: () => ipcRenderer.invoke('get-connection-log-history'),
    
    clear: () => ipcRenderer.invoke('clear-logs'),
    clearConnection: () => ipcRenderer.invoke('clear-connection-logs'),
    
    startConnectionMonitoring: () => ipcRenderer.invoke('start-connection-monitoring'),
    stopConnectionMonitoring: () => ipcRenderer.invoke('stop-connection-monitoring'),
    
    // SingBox日志文件相关
    getSingboxLogFiles: () => ipcRenderer.invoke('get-singbox-log-files'),
    readSingboxLogFile: (filePath) => ipcRenderer.invoke('read-singbox-log-file', filePath),
    getCurrentSingboxLog: () => ipcRenderer.invoke('get-current-singbox-log')
  },

  // 统一的设置管理接口
  settings: {
    save: (settings) => ipcRenderer.invoke('save-settings', settings),
    get: () => ipcRenderer.invoke('get-settings'),
    setAutoLaunch: (enable) => ipcRenderer.invoke('set-auto-launch', enable),
    getAutoLaunch: () => ipcRenderer.invoke('get-auto-launch'),
    clearCache: () => ipcRenderer.invoke('clear-app-cache')
  },

  // 获取规则集和节点组信息
  getRuleSets: () => ipcRenderer.invoke('get-rule-sets'),
  getNodeGroups: () => ipcRenderer.invoke('get-node-groups'),
  getRouteRules: () => ipcRenderer.invoke('get-route-rules'),

  // 添加引擎到窗口对象，用于前端直接使用
  engine: {
    getValueByPath: (obj, path) => {
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

  // 统一的节点管理接口
  nodes: {
    getHistory: (nodeTag) => ipcRenderer.invoke('get-node-history', nodeTag),
    loadAllHistory: () => ipcRenderer.invoke('load-all-node-history'),
    isHistoryEnabled: () => ipcRenderer.invoke('is-node-history-enabled'),
    getTotalTraffic: (nodeTag) => ipcRenderer.invoke('get-node-total-traffic', nodeTag),
    getAllTotalTraffic: () => ipcRenderer.invoke('get-all-nodes-total-traffic'),
    resetTotalTraffic: (nodeTag) => ipcRenderer.invoke('reset-node-total-traffic', nodeTag)
  },

  // 监听代理状态恢复
  onProxyStateRestored: (callback) => {
    ipcRenderer.on('proxy-state-restored', callback);
  },
  removeProxyStateRestored: (callback) => {
    ipcRenderer.removeListener('proxy-state-restored', callback);
  },

  // 统一的版本管理接口
  version: {
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    getAll: () => ipcRenderer.invoke('get-all-versions')
  },

  // 统一的内核管理接口
  coreManager: {
    // 旧的 sing-box 专用接口（保持向后兼容）
    getSingBoxReleases: () => ipcRenderer.invoke('core-manager-get-singbox-releases'),
    getInstalledVersions: () => ipcRenderer.invoke('core-manager-get-installed-versions'),
    downloadVersion: (version) => ipcRenderer.invoke('core-manager-download-version', version),
    switchVersion: (version) => ipcRenderer.invoke('core-manager-switch-version', version),
    deleteVersion: (version) => ipcRenderer.invoke('core-manager-delete-version', version),

    // 新的通用接口
    getReleases: (coreType) => ipcRenderer.invoke('core-manager-get-releases', coreType),
    downloadCore: (coreType, version) => ipcRenderer.invoke('core-manager-download-core', coreType, version),
    getLatestVersion: (coreType) => ipcRenderer.invoke('core-manager-get-latest-version', coreType),
    checkCoreInstalled: (coreType) => ipcRenderer.invoke('core-manager-check-core-installed', coreType)
  },

  // 统一的内核接口（新）
  core: {
    // 内核类型管理
    getSupportedTypes: () => ipcRenderer.invoke('core-get-supported-types'),
    getCurrentType: () => ipcRenderer.invoke('core-get-current-type'),
    switchType: (coreType) => ipcRenderer.invoke('core-switch-type', coreType),

    // 内核控制
    start: (options) => ipcRenderer.invoke('core-start', options),
    stop: () => ipcRenderer.invoke('core-stop'),

    // 状态查询
    getStatus: () => ipcRenderer.invoke('core-get-status'),
    getDetailedStatus: () => ipcRenderer.invoke('core-get-detailed-status'),
    getVersion: () => ipcRenderer.invoke('core-get-version'),
    checkInstalled: () => ipcRenderer.invoke('core-check-installed'),

    // 配置管理
    checkConfig: (configPath) => ipcRenderer.invoke('core-check-config', configPath),
    formatConfig: (configPath) => ipcRenderer.invoke('core-format-config', configPath),

    // 其他功能
    download: () => ipcRenderer.invoke('core-download'),
    getAllStatus: () => ipcRenderer.invoke('core-get-all-status'),
    getConfigInfo: () => ipcRenderer.invoke('core-get-config-info'),
    checkFeatureSupport: (feature) => ipcRenderer.invoke('core-check-feature-support', feature)
  },

  // 统一的网络工具接口
  traceroute: {
    execute: (target) => ipcRenderer.invoke('traceroute:execute', target),
    executeRealtime: (target) => ipcRenderer.invoke('traceroute:executeRealtime', target),
    validate: (target) => ipcRenderer.invoke('traceroute:validate', target),
    stop: () => ipcRenderer.invoke('traceroute:stop'),

    // 实时事件监听
    onStarted: (callback) => {
      ipcRenderer.on('traceroute:started', (event, data) => callback(data));
      return () => ipcRenderer.removeListener('traceroute:started', callback);
    },
    onDestination: (callback) => {
      ipcRenderer.on('traceroute:destination', (event, data) => callback(data));
      return () => ipcRenderer.removeListener('traceroute:destination', callback);
    },
    onHop: (callback) => {
      ipcRenderer.on('traceroute:hop', (event, data) => callback(data));
      return () => ipcRenderer.removeListener('traceroute:hop', callback);
    },
    onComplete: (callback) => {
      ipcRenderer.on('traceroute:complete', (event, data) => callback(data));
      return () => ipcRenderer.removeListener('traceroute:complete', callback);
    },
    onError: (callback) => {
      ipcRenderer.on('traceroute:error', (event, data) => callback(data));
      return () => ipcRenderer.removeListener('traceroute:error', callback);
    },
    onTimeout: (callback) => {
      ipcRenderer.on('traceroute:timeout', (event, data) => callback(data));
      return () => ipcRenderer.removeListener('traceroute:timeout', callback);
    }
  },

  // 暴露ipcRenderer用于监听特定事件
  ipcRenderer: {
    on: (channel, callback) => {
      ipcRenderer.on(channel, callback);
      return () => ipcRenderer.removeListener(channel, callback);
    },
    removeListener: (channel, callback) => ipcRenderer.removeListener(channel, callback),
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args)
  }
}); 