const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const { getAppDataDir, generateDefaultLogPath } = require('../utils/paths');
const nodeHistoryManager = require('./data-managers/node-history-manager');
const ConfigParser = require('../utils/sing-box/config-parser');
const { CORE_TYPES } = require('../constants/core-types');

class SettingsManager {
  constructor() {
    this.settings = {
      proxyPort: '7890',
      apiAddress: '127.0.0.1:9090',
      allowLan: false,

      autoStart: false,
      checkUpdateOnBoot: true,
      tunMode: false,

      // 内核设置
      coreType: CORE_TYPES.SINGBOX,

      // 日志设置
      logLevel: 'info',
      logOutput: '',
      logDisabled: false,

      // Nodes 相关设置
      nodeAdvancedMonitoring: false,
      nodeExitStatusMonitoring: false,
      nodeExitIPPurity: false,
      keepNodeTrafficHistory: false,

      // 高级设置
      kernelWatchdog: true,
      language: 'zh_CN',
      foregroundOnly: false
    };
    
    this.configParser = new ConfigParser();
    this.cachedDefaultLogPath = null;
  }

  // 加载设置
  async loadSettings() {
    try {
      const appDataDir = getAppDataDir();
      const settingsPath = path.join(appDataDir, 'settings.json');
      
      if (!fs.existsSync(settingsPath)) {
        return this.settings;
      }
      
      const settingsData = fs.readFileSync(settingsPath, 'utf8');
      const savedSettings = JSON.parse(settingsData);
      
      // 合并保存的设置和默认设置
      this.settings = {
        ...this.settings,
        ...savedSettings
      };
      
      // 同步开机自启动状态
      await this.syncAutoLaunch();
      
      // 同步节点历史数据设置
      nodeHistoryManager.setEnabled(this.settings.keepNodeTrafficHistory);
      
      logger.info('设置已加载');
      return this.settings;
    } catch (error) {
      logger.error('加载设置失败:', error);
      return this.settings;
    }
  }

  // 保存设置
  async saveSettings(settings) {
    try {
      const appDataDir = getAppDataDir();
      const settingsPath = path.join(appDataDir, 'settings.json');
      
      // 更新内存中的设置
      this.settings = {
        ...this.settings,
        ...settings
      };
      
      // 保存到文件
      fs.writeFileSync(settingsPath, JSON.stringify(this.settings, null, 2));
      
      // 如果设置中包含autoStart，同步开机自启动状态
      if ('autoStart' in settings) {
        await this.setAutoLaunch(settings.autoStart);
      }
      
      // 如果设置中包含keepNodeTrafficHistory，更新节点历史数据管理器的设置
      if ('keepNodeTrafficHistory' in settings) {
        nodeHistoryManager.setEnabled(settings.keepNodeTrafficHistory);
      }
      
      logger.info('设置已保存');
      return { success: true };
    } catch (error) {
      logger.error('保存设置失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 获取当前设置
  getSettings() {
    return this.settings;
  }

  /**
   * 从配置文件读取代理端口并更新设置
   * @param {String} configPath 配置文件路径
   * @returns {Number} 代理端口
   */
  updateProxyPortFromConfig(configPath) {
    try {
      if (!configPath || !fs.existsSync(configPath)) {
        logger.warn(`配置文件不存在，使用默认代理端口: ${this.settings.proxyPort}`);
        return parseInt(this.settings.proxyPort);
      }
      
      const configInfo = this.configParser.parseConfigFile(configPath);
      if (configInfo && configInfo.port) {
        const newPort = configInfo.port.toString();
        if (this.settings.proxyPort !== newPort) {
          logger.info(`从配置文件更新代理端口: ${this.settings.proxyPort} -> ${newPort}`);
          this.settings.proxyPort = newPort;
        }
        return configInfo.port;
      } else {
        logger.warn(`无法从配置文件解析代理端口，使用默认端口: ${this.settings.proxyPort}`);
        return parseInt(this.settings.proxyPort);
      }
    } catch (error) {
      logger.error(`从配置文件读取代理端口失败: ${error.message}`);
      return parseInt(this.settings.proxyPort);
    }
  }

  /**
   * 获取统一的代理配置对象
   * @param {String} configPath 配置文件路径（可选）
   * @returns {Object} 代理配置对象
   */
  getProxyConfig(configPath = null) {
    const port = configPath ? this.updateProxyPortFromConfig(configPath) : parseInt(this.settings.proxyPort);

    return {
      host: '127.0.0.1',
      port: port,
      enableSystemProxy: true
    };
  }

  /**
   * 从配置文件获取 API 地址
   * @param {String} configPath 配置文件路径
   * @returns {String} API 地址
   */
  getApiAddressFromConfig(configPath) {
    try {
      if (!configPath || !fs.existsSync(configPath)) {
        logger.warn(`配置文件不存在，使用默认API地址: ${this.settings.apiAddress}`);
        return this.settings.apiAddress;
      }

      const adapter = this.getCurrentCoreAdapter();
      const configInfo = adapter.parseConfigFile(configPath);

      if (configInfo && configInfo.apiAddress) {
        logger.info(`从配置文件获取API地址: ${configInfo.apiAddress}`);
        return configInfo.apiAddress;
      } else {
        logger.warn(`无法从配置文件解析API地址，使用默认地址: ${this.settings.apiAddress}`);
        return this.settings.apiAddress;
      }
    } catch (error) {
      logger.error(`从配置文件读取API地址失败: ${error.message}`);
      return this.settings.apiAddress;
    }
  }

  /**
   * 获取启动内核所需的完整配置
   * @param {String} configPath 配置文件路径
   * @param {Object} overrides 覆盖配置（可选）
   * @returns {Object} 启动配置对象
   */
  getStartupConfig(configPath, overrides = {}) {
    const settings = this.getSettings();
    const proxyConfig = this.getProxyConfig(configPath);

    return {
      configPath,
      proxyConfig: { ...proxyConfig, ...overrides.proxyConfig },
      enableSystemProxy: overrides.enableSystemProxy !== undefined ?
        overrides.enableSystemProxy : proxyConfig.enableSystemProxy,
      tunMode: overrides.tunMode !== undefined ?
        overrides.tunMode : (settings.tunMode || false)
    };
  }

  /**
   * 获取或生成日志文件路径
   * @returns {String} 日志文件路径
   */
  getLogPath() {
    let logPath;
    
    if (!this.settings.logOutput || this.settings.logOutput.trim() === '') {
      // 如果用户没有指定日志路径，检查是否已有默认路径
      if (!this.cachedDefaultLogPath) {
        // 生成并缓存默认路径
        this.cachedDefaultLogPath = generateDefaultLogPath();
      }
      logPath = this.cachedDefaultLogPath;
    } else {
      logPath = this.settings.logOutput;
    }
    
    // 确保日志文件的目录存在
    try {
      const logDir = path.dirname(logPath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    } catch (dirError) {
      logger.error(`设置管理器创建日志目录失败: ${dirError.message}`);
    }
    
    return logPath;
  }

  // 设置开机自启动
  async setAutoLaunch(enable) {
    try {
      if (enable) {
        app.setLoginItemSettings({
          openAtLogin: true,
          path: app.getPath('exe'),
          args: []
        });
      } else {
        app.setLoginItemSettings({
          openAtLogin: false
        });
      }
      
      // 更新内存中的设置
      this.settings.autoStart = enable;
      
      logger.info(`开机自启动已${enable ? '启用' : '禁用'}`);
      return { success: true };
    } catch (error) {
      logger.error('设置开机自启动失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 获取开机自启动状态
  async getAutoLaunch() {
    try {
      const loginSettings = app.getLoginItemSettings();
      return { success: true, enabled: loginSettings.openAtLogin };
    } catch (error) {
      logger.error('获取开机自启动状态失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 同步开机自启动状态
  async syncAutoLaunch() {
    try {
      const loginSettings = app.getLoginItemSettings();
      const { openAtLogin } = loginSettings;
      this.settings.autoStart = openAtLogin;
      logger.info(`同步开机自启动状态: ${openAtLogin ? '已启用' : '未启用'}`);
    } catch (error) {
      logger.error('同步开机自启动状态失败:', error);
    }
  }

  /**
   * 获取当前内核类型
   * @returns {string} 内核类型
   */
  getCoreType() {
    return this.settings.coreType || CORE_TYPES.SINGBOX;
  }

  /**
   * 设置内核类型
   * @param {string} coreType 内核类型
   * @returns {Promise<Object>} 设置结果
   */
  async setCoreType(coreType) {
    try {
      const { isSupportedCoreType } = require('../constants/core-types');

      if (!isSupportedCoreType(coreType)) {
        return { success: false, error: `不支持的内核类型: ${coreType}` };
      }

      const oldCoreType = this.settings.coreType;
      this.settings.coreType = coreType;

      // 保存设置
      await this.saveSettings({ coreType });

      logger.info(`内核类型已从 ${oldCoreType} 切换到 ${coreType}`);
      return {
        success: true,
        previousCore: oldCoreType,
        currentCore: coreType
      };
    } catch (error) {
      logger.error('设置内核类型失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取当前内核的配置适配器
   * @returns {Object} 配置适配器
   */
  getCurrentCoreAdapter() {
    const coreType = this.getCoreType();

    try {
      if (coreType === CORE_TYPES.MIHOMO) {
        const MihomoConfigParser = require('../utils/mihomo/config-parser');
        return new MihomoConfigParser();
      } else {
        // 默认使用 sing-box 解析器
        return this.configParser;
      }
    } catch (error) {
      logger.warn(`无法加载 ${coreType} 配置适配器，使用默认解析器:`, error);
      return this.configParser;
    }
  }
}

// 创建单例实例
const settingsManager = new SettingsManager();
module.exports = settingsManager; 